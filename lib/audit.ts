import { prisma } from "@/lib/db";

export interface AuditLogEntry {
  entityType: "AFE" | "USER" | "SIGNER";
  entityId: string;
  action: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event to the database
 */
export async function logAudit({
  entityType,
  entityId,
  action,
  userId,
  ipAddress,
  userAgent,
  metadata,
}: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        userId,
        ipAddress,
        userAgent,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (error) {
    // Log error but don't throw - audit failures shouldn't break the main flow
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Get audit logs for a specific entity
 */
export async function getAuditLogs(
  entityType: string,
  entityId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
) {
  return prisma.auditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      timestamp: "desc",
    },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  });
}

/**
 * Get all audit logs with filtering
 */
export async function getAllAuditLogs(options?: {
  entityType?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {};

  if (options?.entityType) {
    where.entityType = options.entityType;
  }
  if (options?.userId) {
    where.userId = options.userId;
  }
  if (options?.startDate || options?.endDate) {
    where.timestamp = {};
    if (options?.startDate) {
      (where.timestamp as Record<string, Date>).gte = options.startDate;
    }
    if (options?.endDate) {
      (where.timestamp as Record<string, Date>).lte = options.endDate;
    }
  }

  return prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      timestamp: "desc",
    },
    take: options?.limit || 100,
    skip: options?.offset || 0,
  });
}
