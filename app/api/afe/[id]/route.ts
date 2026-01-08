import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { getClientIp, getUserAgent } from "@/lib/utils";

// GET /api/afe/[id] - Get single AFE
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const afe = await prisma.afe.findUnique({
    where: { id: params.id },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
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

  if (!afe) {
    return NextResponse.json({ error: "AFE not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: afe });
}

// DELETE /api/afe/[id] - Delete AFE (draft only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const afe = await prisma.afe.findUnique({
    where: { id: params.id },
  });

  if (!afe) {
    return NextResponse.json({ error: "AFE not found" }, { status: 404 });
  }

  if (afe.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Can only delete AFEs in draft status" },
      { status: 400 }
    );
  }

  await prisma.afe.delete({
    where: { id: params.id },
  });

  await logAudit({
    entityType: "AFE",
    entityId: params.id,
    action: "DELETED",
    userId: user.id,
    ipAddress: getClientIp(req.headers),
    userAgent: getUserAgent(req.headers),
    metadata: { afeName: afe.afeName },
  });

  return NextResponse.json({ success: true });
}
