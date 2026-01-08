import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/utils";
import { z } from "zod";

// GET /api/users/signature - Get current user's signature
export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { signatureImage: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      hasSignature: !!user?.signatureImage,
      signatureImage: user?.signatureImage || null,
    },
  });
}

const saveSignatureSchema = z.object({
  signatureImage: z.string().min(1, "Signature is required"),
});

// POST /api/users/signature - Save user's signature
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipAddress = getClientIp(req.headers);
  const userAgent = getUserAgent(req.headers);

  try {
    const body = await req.json();
    const { signatureImage } = saveSignatureSchema.parse(body);

    // Validate that it's a valid data URL
    if (!signatureImage.startsWith("data:image/png;base64,")) {
      return NextResponse.json(
        { error: "Invalid signature format" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { signatureImage },
    });

    await logAudit({
      entityType: "USER",
      entityId: currentUser.id,
      action: "SIGNATURE_UPDATED",
      userId: currentUser.id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: "Signature saved successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error saving signature:", error);
    return NextResponse.json(
      { error: "Failed to save signature" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/signature - Remove user's signature
export async function DELETE(req: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipAddress = getClientIp(req.headers);
  const userAgent = getUserAgent(req.headers);

  await prisma.user.update({
    where: { id: currentUser.id },
    data: { signatureImage: null },
  });

  await logAudit({
    entityType: "USER",
    entityId: currentUser.id,
    action: "SIGNATURE_REMOVED",
    userId: currentUser.id,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({
    success: true,
    message: "Signature removed successfully",
  });
}
