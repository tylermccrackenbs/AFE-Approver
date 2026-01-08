"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AfeStatusBadge } from "@/components/afe/afe-status-badge";
import { formatDate } from "@/lib/utils";
import { MOCK_USER } from "@/lib/auth";
import { Skeleton, SkeletonAfeCard } from "@/components/ui/skeleton";
import {
  FileText,
  Plus,
  Clock,
  CheckCircle,
  FileEdit,
  FileClock,
  FileCheck,
  AlertCircle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

interface AfeItem {
  id: string;
  afeName: string;
  afeNumber?: string;
  status: "DRAFT" | "PENDING" | "PARTIALLY_SIGNED" | "FULLY_SIGNED" | "REJECTED" | "CANCELLED";
  createdAt: string;
  signers: Array<{
    status: string;
    user: { id: string; name: string };
  }>;
}

interface DashboardStats {
  draft: number;
  pending: number;
  completed: number;
  rejected: number;
}

export default function DashboardPage() {
  const user = MOCK_USER;
  const [pendingAfes, setPendingAfes] = useState<AfeItem[]>([]);
  const [recentAfes, setRecentAfes] = useState<AfeItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ draft: 0, pending: 0, completed: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch("/api/afe?pageSize=50");
      const data = await res.json();
      if (data.success) {
        const allAfes: AfeItem[] = data.data;

        // Filter to AFEs where current user is an active signer
        const pending = allAfes.filter((afe: AfeItem) =>
          afe.signers.some(
            (s) => s.user.id === user.id && s.status === "ACTIVE"
          )
        );
        setPendingAfes(pending);

        // Get recent AFEs (any status, for admin view)
        setRecentAfes(allAfes.slice(0, 5));

        // Calculate stats
        const newStats: DashboardStats = {
          draft: allAfes.filter(a => a.status === "DRAFT").length,
          pending: allAfes.filter(a => ["PENDING", "PARTIALLY_SIGNED"].includes(a.status)).length,
          completed: allAfes.filter(a => a.status === "FULLY_SIGNED").length,
          rejected: allAfes.filter(a => a.status === "REJECTED").length,
        };
        setStats(newStats);
      }
    } catch (error) {
      console.error("Error fetching AFEs:", error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user.role === "ADMIN";

  const statCards = [
    {
      title: "Drafts",
      value: stats.draft,
      icon: FileEdit,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
      description: "Awaiting submission"
    },
    {
      title: "In Progress",
      value: stats.pending,
      icon: FileClock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      description: "Pending signatures"
    },
    {
      title: "Completed",
      value: stats.completed,
      icon: FileCheck,
      color: "text-green-600",
      bgColor: "bg-green-100",
      description: "Fully signed"
    },
    {
      title: "Rejected",
      value: stats.rejected,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
      description: "Needs attention"
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening with your AFE approvals
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

      {/* Stats Grid */}
      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                    <Skeleton className="h-4 w-20 mt-3" />
                    <Skeleton className="h-3 w-28 mt-1" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            statCards.map((stat) => (
              <Card key={stat.title} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                    <span className="text-3xl font-bold">{stat.value}</span>
                  </div>
                  <div className="mt-3">
                    <p className="font-medium">{stat.title}</p>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Your Signature */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Action Required</CardTitle>
                  <CardDescription>AFEs awaiting your signature</CardDescription>
                </div>
              </div>
              {pendingAfes.length > 0 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {pendingAfes.length}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <SkeletonAfeCard key={i} />
                ))}
              </div>
            ) : pendingAfes.length === 0 ? (
              <div className="text-center py-8 rounded-lg bg-green-50 border border-green-100">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium text-green-900">All caught up!</p>
                <p className="text-sm text-green-700 mt-1">No AFEs pending your signature</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingAfes.slice(0, 4).map((afe) => (
                  <Link
                    key={afe.id}
                    href={`/afe/${afe.id}`}
                    className="group block rounded-lg border p-4 hover:border-primary hover:bg-primary/5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                          <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate group-hover:text-primary">{afe.afeName}</p>
                          {afe.afeNumber && (
                            <p className="text-sm text-muted-foreground">#{afe.afeNumber}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Created {formatDate(afe.createdAt)}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity (Admin) */}
        {isAdmin && (
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Recent AFEs</CardTitle>
                    <CardDescription>Latest document activity</CardDescription>
                  </div>
                </div>
                <Link href="/afe">
                  <Button variant="ghost" size="sm" className="gap-1">
                    View all
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : recentAfes.length === 0 ? (
                <div className="text-center py-8 rounded-lg bg-muted/50">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-medium">No AFEs yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Create your first AFE to get started</p>
                  <Link href="/afe/new">
                    <Button className="mt-4" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Create AFE
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentAfes.map((afe) => {
                    const activeSigner = afe.signers.find(s => s.status === "ACTIVE");
                    return (
                      <Link
                        key={afe.id}
                        href={`/afe/${afe.id}`}
                        className="group flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="p-2 rounded-lg bg-muted group-hover:bg-background">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{afe.afeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {activeSigner
                              ? `Waiting on ${activeSigner.user.name.split(' ')[0]}`
                              : formatDate(afe.createdAt)
                            }
                          </p>
                        </div>
                        <AfeStatusBadge status={afe.status} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Non-admin: View All button */}
        {!isAdmin && (
          <Card className="lg:col-span-1">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">View All Documents</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Browse all AFE documents you have access to
              </p>
              <Link href="/afe">
                <Button>
                  View AFE Documents
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
