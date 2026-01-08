"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  timestamp: string;
  ipAddress?: string;
  user?: {
    name: string;
    email: string;
  };
  metadata?: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  const fetchLogs = async () => {
    try {
      const url = filter
        ? `/api/audit?entityType=${filter}`
        : "/api/audit";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterOptions = [
    { value: null, label: "All" },
    { value: "AFE", label: "AFE" },
    { value: "USER", label: "User" },
    { value: "SIGNER", label: "Signer" },
  ];

  const parseMetadata = (metadata?: string) => {
    if (!metadata) return null;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">
          Track all system activities and changes
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {filterOptions.map((option) => (
          <Button
            key={option.value || "all"}
            variant={filter === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const metadata = parseMetadata(log.metadata);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{log.action}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs bg-muted px-2 py-1 rounded">
                          {log.entityType}
                        </span>
                        <span className="ml-2 text-muted-foreground text-xs">
                          {log.entityId.slice(0, 8)}...
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.user ? log.user.name : "System"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.ipAddress || "-"}
                      </TableCell>
                      <TableCell>
                        {metadata && (
                          <span className="text-xs text-muted-foreground">
                            {JSON.stringify(metadata).slice(0, 50)}
                            {JSON.stringify(metadata).length > 50 && "..."}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
