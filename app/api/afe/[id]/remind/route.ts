import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendNotification } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth";
import { getClientIp, getUserAgent } from "@/lib/utils";

// POST /api/afe/[id]/remind - Send reminder to active signer
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can send reminders
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can send reminders" },
      { status: 403 }
    );
  }

  const afe = await prisma.afe.findUnique({
    where: { id: params.id },
    include: {
      signers: {
        include: { user: true },
        orderBy: { signingOrder: "asc" },
      },
    },
  });

  if (!afe) {
    return NextResponse.json({ error: "AFE not found" }, { status: 404 });
  }

  // Find the active signer
  const activeSigner = afe.signers.find((s) => s.status === "ACTIVE");

  if (!activeSigner) {
    return NextResponse.json(
      { error: "No active signer to remind. AFE may be fully signed, rejected, or still in draft." },
      { status: 400 }
    );
  }

  // Send reminder email
  await sendNotification("REMINDER", activeSigner.user.email, {
    afeName: afe.afeName,
    afeId: afe.id,
    signerName: activeSigner.user.name,
  });

  // Log the reminder
  await logAudit({
    entityType: "AFE",
    entityId: params.id,
    action: "REMINDER_SENT",
    userId: user.id,
    ipAddress: getClientIp(req.headers),
    userAgent: getUserAgent(req.headers),
    metadata: {
      reminderSentTo: activeSigner.user.email,
      signerName: activeSigner.user.name,
    },
  });

  return NextResponse.json({
    success: true,
    message: `Reminder sent to ${activeSigner.user.name}`,
    sentTo: activeSigner.user.email,
  });
}
