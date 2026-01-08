import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendNotification } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth";
import { getClientIp, getUserAgent } from "@/lib/utils";
import { z } from "zod";

const rejectSchema = z.object({
  reason: z.string().max(1000).optional(),
});

// POST /api/afe/[id]/reject - Reject the AFE
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

  let reason: string | undefined;
  try {
    const body = await req.json();
    const validated = rejectSchema.parse(body);
    reason = validated.reason;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
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
      { error: "It is not your turn to act on this AFE" },
      { status: 403 }
    );
  }

  if (!["PENDING", "PARTIALLY_SIGNED"].includes(afe.status)) {
    return NextResponse.json(
      { error: "This AFE cannot be rejected in its current state" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.afeSigner.update({
      where: { id: signerSlot.id },
      data: {
        status: "REJECTED",
        signedAt: new Date(),
        ipAddress,
        userAgent,
      },
    });

    await tx.afe.update({
      where: { id: afeId },
      data: { status: "REJECTED" },
    });
  });

  await logAudit({
    entityType: "AFE",
    entityId: afeId,
    action: "REJECTED",
    userId: user.id,
    ipAddress,
    userAgent,
    metadata: {
      signingOrder: signerSlot.signingOrder,
      signerName: user.name,
      reason,
    },
  });

  await sendNotification("AFE_REJECTED", afe.createdBy.email, {
    afeName: afe.afeName,
    afeId: afe.id,
    rejectedBy: user.name ?? user.email ?? "Unknown user",
    rejectReason: reason,
  });

  return NextResponse.json({
    success: true,
    message: "AFE has been rejected",
  });
}
