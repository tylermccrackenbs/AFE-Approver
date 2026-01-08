import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendNotification, sendBulkNotification, getCompletionGroupEmails } from "@/lib/email";
import { generateFinalPdf } from "@/lib/pdf";
import { getCurrentUser } from "@/lib/auth";
import { readPdf } from "@/lib/storage";
import { getClientIp, getUserAgent } from "@/lib/utils";
import { z } from "zod";

const signSchema = z.object({
  confirmed: z.literal(true, {
    errorMap: () => ({ message: "You must confirm before signing" }),
  }),
  signatureImage: z.string().min(1, "Signature is required"),
  signatureX: z.number().optional(), // X coordinate for signature placement on PDF
  signatureY: z.number().optional(), // Y coordinate for signature placement on PDF (from bottom)
  signatureWidth: z.number().optional(), // Width of signature box
  signatureHeight: z.number().optional(), // Height of signature box
});

// POST /api/afe/[id]/sign - Sign the AFE
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const afeId = params.id;
  const ipAddress = getClientIp(req.headers);
  const userAgent = getUserAgent(req.headers);

  let signatureImage: string;
  let signatureX: number | undefined;
  let signatureY: number | undefined;
  let signatureWidth: number | undefined;
  let signatureHeight: number | undefined;
  try {
    const body = await req.json();
    const validated = signSchema.parse(body);
    signatureImage = validated.signatureImage;
    signatureX = validated.signatureX;
    signatureY = validated.signatureY;
    signatureWidth = validated.signatureWidth;
    signatureHeight = validated.signatureHeight;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }

  const afe = await prisma.afe.findUnique({
    where: { id: afeId },
    include: {
      signers: {
        include: { user: true },
        orderBy: { signingOrder: "asc" },
      },
      createdBy: true,
    },
  });

  if (!afe) {
    return NextResponse.json({ error: "AFE not found" }, { status: 404 });
  }

  const signerSlot = afe.signers.find((s) => s.userId === user.id);
  if (!signerSlot) {
    return NextResponse.json(
      { error: "You are not a signer on this AFE" },
      { status: 403 }
    );
  }

  if (signerSlot.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "It is not your turn to sign this AFE" },
      { status: 403 }
    );
  }

  const previousSigners = afe.signers.filter(
    (s) => s.signingOrder < signerSlot.signingOrder
  );
  const allPreviousSigned = previousSigners.every((s) => s.status === "SIGNED");
  if (!allPreviousSigned) {
    return NextResponse.json(
      { error: "Previous signers have not completed signing" },
      { status: 403 }
    );
  }

  if (!["PENDING", "PARTIALLY_SIGNED"].includes(afe.status)) {
    return NextResponse.json(
      { error: "This AFE cannot be signed in its current state" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Use provided coordinates, or fall back to predefined ones from AFE setup
    const finalSignatureX = signatureX ?? signerSlot.signatureX;
    const finalSignatureY = signatureY ?? signerSlot.signatureY;
    const finalSignatureWidth = signatureWidth ?? signerSlot.signatureWidth;
    const finalSignatureHeight = signatureHeight ?? signerSlot.signatureHeight;

    await tx.afeSigner.update({
      where: { id: signerSlot.id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureImage,
        signatureX: finalSignatureX,
        signatureY: finalSignatureY,
        signatureWidth: finalSignatureWidth,
        signatureHeight: finalSignatureHeight,
        ipAddress,
        userAgent,
      },
    });

    const nextSigner = afe.signers.find(
      (s) => s.signingOrder === signerSlot.signingOrder + 1
    );

    let newAfeStatus: "PARTIALLY_SIGNED" | "FULLY_SIGNED" = "PARTIALLY_SIGNED";

    if (nextSigner) {
      await tx.afeSigner.update({
        where: { id: nextSigner.id },
        data: { status: "ACTIVE" },
      });
    } else {
      newAfeStatus = "FULLY_SIGNED";
    }

    const updatedAfe = await tx.afe.update({
      where: { id: afeId },
      data: { status: newAfeStatus },
    });

    return { updatedAfe, nextSigner, newAfeStatus };
  });

  await logAudit({
    entityType: "AFE",
    entityId: afeId,
    action: "SIGNED",
    userId: user.id,
    ipAddress,
    userAgent,
    metadata: {
      signingOrder: signerSlot.signingOrder,
      signerName: user.name,
    },
  });

  if (result.nextSigner) {
    // Read the PDF to attach to the email
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await readPdf(afe.originalPdfUrl);
    } catch (err) {
      console.error("Failed to read PDF for email attachment:", err);
    }

    await sendNotification("SIGNER_ACTIVATED", result.nextSigner.user.email, {
      afeName: afe.afeName,
      afeId: afe.id,
      pdfBuffer,
      pdfFilename: `${afe.afeName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
    });
  }

  if (result.newAfeStatus === "FULLY_SIGNED") {
    let finalPdfUrl: string | undefined;
    try {
      finalPdfUrl = await generateFinalPdf(afeId);
    } catch (error) {
      console.error("Failed to generate final PDF:", error);
    }

    // Read the signed PDF for email attachment
    let signedPdfBuffer: Buffer | undefined;
    if (finalPdfUrl) {
      try {
        signedPdfBuffer = await readPdf(finalPdfUrl);
      } catch (err) {
        console.error("Failed to read signed PDF for email attachment:", err);
      }
    }

    const pdfFilename = `${afe.afeName.replace(/[^a-zA-Z0-9]/g, "_")}_SIGNED.pdf`;

    // Get distribution group recipients
    const completionGroupEmails = getCompletionGroupEmails();

    // Combine creator + distribution group (deduplicate)
    const allRecipients = [
      afe.createdBy.email,
      ...completionGroupEmails,
    ].filter((email, index, arr) => arr.indexOf(email) === index);

    // Send completion notification with signed PDF to all recipients
    await sendBulkNotification("AFE_FULLY_SIGNED", allRecipients, {
      afeName: afe.afeName,
      afeId: afe.id,
      pdfBuffer: signedPdfBuffer,
      pdfFilename,
    });

    console.log(`[AFE] Sent completion notification for "${afe.afeName}" to ${allRecipients.length} recipients`);
  }

  return NextResponse.json({
    success: true,
    status: result.newAfeStatus,
    message:
      result.newAfeStatus === "FULLY_SIGNED"
        ? "AFE has been fully signed"
        : "Signature recorded successfully",
  });
}
