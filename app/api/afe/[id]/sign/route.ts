import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendNotification } from "@/lib/email";
import { generateFinalPdf } from "@/lib/pdf";
import { getCurrentUser } from "@/lib/auth";
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
  const user = getCurrentUser();
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
    await sendNotification("SIGNER_ACTIVATED", result.nextSigner.user.email, {
      afeName: afe.afeName,
      afeId: afe.id,
    });
  }

  if (result.newAfeStatus === "FULLY_SIGNED") {
    try {
      await generateFinalPdf(afeId);
    } catch (error) {
      console.error("Failed to generate final PDF:", error);
    }

    await sendNotification("AFE_FULLY_SIGNED", afe.createdBy.email, {
      afeName: afe.afeName,
      afeId: afe.id,
    });
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
