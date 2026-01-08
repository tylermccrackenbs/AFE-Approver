import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendNotification } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth";
import { getClientIp, getUserAgent } from "@/lib/utils";
import { z } from "zod";

const assignSignersSchema = z.object({
  signers: z.array(
    z.object({
      userId: z.string().uuid(),
      signingOrder: z.number().int().positive(),
      signatureX: z.number().optional(),
      signatureY: z.number().optional(),
      signatureWidth: z.number().optional(),
      signatureHeight: z.number().optional(),
      titleX: z.number().optional(),
      titleY: z.number().optional(),
      titleWidth: z.number().optional(),
      titleHeight: z.number().optional(),
      dateX: z.number().optional(),
      dateY: z.number().optional(),
      dateWidth: z.number().optional(),
      dateHeight: z.number().optional(),
    })
  ).min(1, "At least one signer is required"),
});

// POST /api/afe/[id]/signers - Assign signers to AFE
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();

  const afe = await prisma.afe.findUnique({
    where: { id: params.id },
    include: { signers: true },
  });

  if (!afe) {
    return NextResponse.json({ error: "AFE not found" }, { status: 404 });
  }

  if (afe.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Can only assign signers to draft AFEs" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const validated = assignSignersSchema.parse(body);

    const userIds = validated.signers.map((s) => s.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
    });

    if (users.length !== userIds.length) {
      return NextResponse.json(
        { error: "Some users are invalid" },
        { status: 400 }
      );
    }

    const orders = validated.signers.map((s) => s.signingOrder);
    if (new Set(orders).size !== orders.length) {
      return NextResponse.json(
        { error: "Signing orders must be unique" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.afeSigner.deleteMany({
        where: { afeId: params.id },
      });

      const signersData = validated.signers.map((s) => ({
        afeId: params.id,
        userId: s.userId,
        signingOrder: s.signingOrder,
        status: s.signingOrder === 1 ? "ACTIVE" : "PENDING",
        signatureX: s.signatureX,
        signatureY: s.signatureY,
        signatureWidth: s.signatureWidth,
        signatureHeight: s.signatureHeight,
        titleX: s.titleX,
        titleY: s.titleY,
        titleWidth: s.titleWidth,
        titleHeight: s.titleHeight,
        dateX: s.dateX,
        dateY: s.dateY,
        dateWidth: s.dateWidth,
        dateHeight: s.dateHeight,
      }));

      await tx.afeSigner.createMany({
        data: signersData,
      });

      const updatedAfe = await tx.afe.update({
        where: { id: params.id },
        data: { status: "PENDING" },
        include: {
          signers: {
            include: {
              user: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
            orderBy: { signingOrder: "asc" },
          },
        },
      });

      return updatedAfe;
    });

    await logAudit({
      entityType: "AFE",
      entityId: params.id,
      action: "SIGNERS_ASSIGNED",
      userId: user.id,
      ipAddress: getClientIp(req.headers),
      userAgent: getUserAgent(req.headers),
      metadata: {
        signerCount: validated.signers.length,
        signers: validated.signers,
      },
    });

    const firstSigner = result.signers.find((s) => s.signingOrder === 1);
    if (firstSigner) {
      await sendNotification("SIGNER_ACTIVATED", firstSigner.user.email, {
        afeName: afe.afeName,
        afeId: afe.id,
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error assigning signers:", error);
    return NextResponse.json(
      { error: "Failed to assign signers" },
      { status: 500 }
    );
  }
}

// PUT /api/afe/[id]/signers - Update signer order
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const afe = await prisma.afe.findUnique({
    where: { id: params.id },
    include: { signers: true },
  });

  if (!afe) {
    return NextResponse.json({ error: "AFE not found" }, { status: 404 });
  }

  const hasSigned = afe.signers.some((s) => s.status === "SIGNED");
  if (hasSigned) {
    return NextResponse.json(
      { error: "Cannot modify signers after signing has begun" },
      { status: 400 }
    );
  }

  return POST(req, { params });
}
