import { NextRequest, NextResponse } from "next/server";
import { getAllAuditLogs, getAuditLogs } from "@/lib/audit";

// GET /api/audit - Get audit logs
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType") || undefined;
  const entityId = searchParams.get("entityId") || undefined;
  const userId = searchParams.get("userId") || undefined;
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "50");

  const startDate = startDateStr ? new Date(startDateStr) : undefined;
  const endDate = endDateStr ? new Date(endDateStr) : undefined;

  if (entityType && entityId) {
    const logs = await getAuditLogs(entityType, entityId, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return NextResponse.json({
      success: true,
      data: logs,
    });
  }

  const logs = await getAllAuditLogs({
    entityType,
    userId,
    startDate,
    endDate,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return NextResponse.json({
    success: true,
    data: logs,
    page,
    pageSize,
  });
}
