import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendBulkNotification } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth";
import { getClientIp, getUserAgent } from "@/lib/utils";

// POST /api/afe/[id]/cancel - Cancel an AFE
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can cancel AFEs
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can cancel AFEs" },
      { status: 403 }
    );
  }

  const afe = await prisma.afe.findUnique({
    where: { id: params.id },
    include: {
      signers: {
        include: { user: true },
      },
      createdBy: true,
    },
  });

  if (!afe) {
    return NextResponse.json({ error: "AFE not found" }, { status: 404 });
  }

  // Can't cancel already completed or rejected AFEs
  if (afe.status === "FULLY_SIGNED") {
    return NextResponse.json(
      { error: "Cannot cancel a fully signed AFE" },
      { status: 400 }
    );
  }

  if (afe.status === "CANCELLED") {
    return NextResponse.json(
      { error: "AFE is already cancelled" },
      { status: 400 }
    );
  }

  // Update AFE status to cancelled
  await prisma.afe.update({
    where: { id: params.id },
    data: { status: "CANCELLED" },
  });

  // Log the cancellation
  await logAudit({
    entityType: "AFE",
    entityId: params.id,
    action: "CANCELLED",
    userId: user.id,
    ipAddress: getClientIp(req.headers),
    userAgent: getUserAgent(req.headers),
    metadata: {
      cancelledBy: user.name,
      previousStatus: afe.status,
    },
  });

  return NextResponse.json({
    success: true,
    message: "AFE has been cancelled",
  });
}
