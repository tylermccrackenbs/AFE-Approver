"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AfeStatusBadge, AfeProgress } from "@/components/afe/afe-status-badge";
import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { MOCK_USER } from "@/lib/auth";
import {
  Plus,
  FileText,
  Eye,
  Search,
  Filter,
  ArrowUpDown,
  FileEdit,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
} from "lucide-react";
import { AfeStatus, AfeSignerStatus } from "@/types";
import { cn } from "@/lib/utils";

interface AfeItem {
  id: string;
  afeName: string;
  afeNumber?: string;
  status: AfeStatus;
  createdAt: string;
  createdBy: {
    name: string;
    email: string;
  };
  signers: Array<{
    status: AfeSignerStatus;
    signingOrder: number;
    user: { name: string };
  }>;
}

const statusFilters = [
  { value: null, label: "All", icon: Filter },
  { value: "DRAFT", label: "Draft", icon: FileEdit },
  { value: "PENDING", label: "Pending", icon: Clock },
  { value: "PARTIALLY_SIGNED", label: "In Progress", icon: Clock },
  { value: "FULLY_SIGNED", label: "Completed", icon: CheckCircle2 },
  { value: "REJECTED", label: "Rejected", icon: XCircle },
  { value: "CANCELLED", label: "Cancelled", icon: Ban },
];

export default function AfeListPage() {
  const user = MOCK_USER;
  const [afes, setAfes] = useState<AfeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchAfes();
  }, [statusFilter]);

  const fetchAfes = async () => {
    setLoading(true);
    try {
      const url = statusFilter
        ? `/api/afe?status=${statusFilter}`
        : "/api/afe";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setAfes(data.data);
      }
    } catch (error) {
      console.error("Error fetching AFEs:", error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user.role === "ADMIN";

  // Filter AFEs by search query
  const filteredAfes = afes.filter((afe) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      afe.afeName.toLowerCase().includes(query) ||
      afe.afeNumber?.toLowerCase().includes(query) ||
      afe.createdBy.name.toLowerCase().includes(query)
    );
  });

  // Get counts for filter badges
  const getStatusCount = (status: string | null) => {
    if (status === null) return afes.length;
    return afes.filter((a) => a.status === status).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AFE Documents</h1>
          <p className="text-muted-foreground mt-1">
            Manage authorization for expenditure approvals
          </p>
        </div>
        {isAdmin && (
          <Link href="/afe/new">
            <Button size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              New AFE
            </Button>
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, number, or creator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map((option) => {
            const Icon = option.icon;
            const count = getStatusCount(option.value);
            const isActive = statusFilter === option.value;

            return (
              <Button
                key={option.value || "all"}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(option.value)}
                className={cn(
                  "gap-2 transition-all",
                  isActive && "shadow-md"
                )}
              >
                <Icon className="h-4 w-4" />
                {option.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-full text-xs",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <SkeletonTable rows={5} columns={6} />
            </div>
          ) : filteredAfes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No AFEs found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchQuery
                  ? "Try adjusting your search or filters"
                  : statusFilter
                  ? `No AFEs with status "${statusFilter.replace("_", " ").toLowerCase()}"`
                  : "Get started by creating your first AFE"}
              </p>
              {isAdmin && !searchQuery && !statusFilter && (
                <Link href="/afe/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create AFE
                  </Button>
                </Link>
              )}
              {(searchQuery || statusFilter) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter(null);
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[300px]">Document</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAfes.map((afe) => {
                    const activeSigner = afe.signers.find(
                      (s) => s.status === "ACTIVE"
                    );

                    return (
                      <TableRow
                        key={afe.id}
                        className="group cursor-pointer"
                        onClick={() => {
                          window.location.href = `/afe/${afe.id}`;
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                              <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate group-hover:text-primary transition-colors">
                                {afe.afeName}
                              </p>
                              {afe.afeNumber && (
                                <p className="text-sm text-muted-foreground">
                                  #{afe.afeNumber}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <AfeStatusBadge status={afe.status} />
                        </TableCell>
                        <TableCell>
                          {afe.signers.length > 0 ? (
                            <div className="w-32">
                              <AfeProgress signers={afe.signers} />
                              {activeSigner && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Waiting on {activeSigner.user.name.split(" ")[0]}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No signers
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{afe.createdBy.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(afe.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/afe/${afe.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="ghost" size="sm" className="gap-2">
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results count */}
      {!loading && filteredAfes.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredAfes.length} of {afes.length} AFE{afes.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
