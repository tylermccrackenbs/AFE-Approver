import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { getClientIp, getUserAgent } from "@/lib/utils";
import { z } from "zod";

// GET /api/users - List users
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const search = searchParams.get("search");
  const signersOnly = searchParams.get("signersOnly") === "true";

  const where: Record<string, unknown> = {};

  if (role) {
    where.role = role;
  }

  if (signersOnly) {
    where.role = { in: ["SIGNER", "ADMIN"] };
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      role: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    success: true,
    data: users,
  });
}

const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  title: z.string().max(100).optional(),
  role: z.enum(["ADMIN", "SIGNER", "VIEWER"]).default("SIGNER"),
});

// POST /api/users - Create a new user
export async function POST(req: NextRequest) {
  const currentUser = getCurrentUser();

  try {
    const body = await req.json();
    const validated = createUserSchema.parse(body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        title: validated.title || null,
        role: validated.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        title: true,
        role: true,
        createdAt: true,
      },
    });

    await logAudit({
      entityType: "USER",
      entityId: user.id,
      action: "CREATED",
      userId: currentUser.id,
      ipAddress: getClientIp(req.headers),
      userAgent: getUserAgent(req.headers),
      metadata: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

const updateUserSchema = z.object({
  role: z.enum(["ADMIN", "SIGNER", "VIEWER"]).optional(),
  title: z.string().max(100).nullable().optional(),
});

// PATCH /api/users - Update user role
export async function PATCH(req: NextRequest) {
  const currentUser = getCurrentUser();

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("id");

  if (!userId) {
    return NextResponse.json(
      { error: "User ID is required" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const validated = updateUserSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if changing away from admin role
    if (validated.role && user.role === "ADMIN" && validated.role !== "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last administrator" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: { role?: string; title?: string | null } = {};
    if (validated.role !== undefined) {
      updateData.role = validated.role;
    }
    if (validated.title !== undefined) {
      updateData.title = validated.title;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        title: true,
        role: true,
      },
    });

    await logAudit({
      entityType: "USER",
      entityId: userId,
      action: "USER_UPDATED",
      userId: currentUser.id,
      ipAddress: getClientIp(req.headers),
      userAgent: getUserAgent(req.headers),
      metadata: {
        previousRole: user.role,
        newRole: validated.role,
        previousTitle: user.title,
        newTitle: validated.title,
      },
    });

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/users - Delete a user
export async function DELETE(req: NextRequest) {
  const currentUser = getCurrentUser();

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("id");

  if (!userId) {
    return NextResponse.json(
      { error: "User ID is required" },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        signerSlots: {
          where: {
            status: { in: ["PENDING", "ACTIVE"] },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deleting the last admin
    if (user.role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the last administrator" },
          { status: 400 }
        );
      }
    }

    // Prevent deleting users who are pending signers on active AFEs
    if (user.signerSlots.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete user who is assigned to pending AFEs. Remove them from those AFEs first." },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    await logAudit({
      entityType: "USER",
      entityId: userId,
      action: "DELETED",
      userId: currentUser.id,
      ipAddress: getClientIp(req.headers),
      userAgent: getUserAgent(req.headers),
      metadata: {
        deletedUserName: user.name,
        deletedUserEmail: user.email,
        deletedUserRole: user.role,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
