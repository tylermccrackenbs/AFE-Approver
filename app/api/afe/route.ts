import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { getClientIp, getUserAgent } from "@/lib/utils";
import { z } from "zod";

// Schema for creating an AFE
const createAfeSchema = z.object({
  afeName: z.string().min(1, "AFE name is required").max(255),
  afeNumber: z.string().max(100).optional(),
  originalPdfUrl: z.string().min(1, "PDF URL is required"),
});

// GET /api/afe - List AFEs
export async function GET(req: NextRequest) {
  const user = getCurrentUser();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "10");

  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }

  const [afes, total] = await Promise.all([
    prisma.afe.findMany({
      where,
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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.afe.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: afes,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

// POST /api/afe - Create new AFE
export async function POST(req: NextRequest) {
  const user = getCurrentUser();

  try {
    const body = await req.json();
    const validated = createAfeSchema.parse(body);

    const afe = await prisma.afe.create({
      data: {
        afeName: validated.afeName,
        afeNumber: validated.afeNumber,
        originalPdfUrl: validated.originalPdfUrl,
        status: "DRAFT",
        createdById: user.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    await logAudit({
      entityType: "AFE",
      entityId: afe.id,
      action: "CREATED",
      userId: user.id,
      ipAddress: getClientIp(req.headers),
      userAgent: getUserAgent(req.headers),
      metadata: { afeName: afe.afeName },
    });

    return NextResponse.json({ success: true, data: afe }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating AFE:", error);
    return NextResponse.json(
      { error: "Failed to create AFE" },
      { status: 500 }
    );
  }
}
