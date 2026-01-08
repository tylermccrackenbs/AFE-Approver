"use client";

import { SignerStatusBadge } from "./afe-status-badge";
import { formatDateTime } from "@/lib/utils";
import { Check, Clock, X, User, Mail } from "lucide-react";
import { AfeSignerStatus } from "@/types";
import { cn } from "@/lib/utils";

interface Signer {
  id: string;
  signingOrder: number;
  status: AfeSignerStatus;
  signedAt?: Date | string | null;
  user: {
    id: string;
    name: string;
    email: string;
    title?: string | null;
  };
}

interface SignerListProps {
  signers: Signer[];
  currentUserId?: string;
  compact?: boolean;
}

export function SignerList({ signers, currentUserId, compact = false }: SignerListProps) {
  const sortedSigners = [...signers].sort(
    (a, b) => a.signingOrder - b.signingOrder
  );

  const getStatusInfo = (status: AfeSignerStatus) => {
    switch (status) {
      case "SIGNED":
        return {
          icon: Check,
          bgColor: "bg-green-500",
          borderColor: "border-green-500",
          iconBg: "bg-green-100",
          iconColor: "text-green-600",
          lineColor: "bg-green-500",
        };
      case "ACTIVE":
        return {
          icon: Clock,
          bgColor: "bg-yellow-500",
          borderColor: "border-yellow-500",
          iconBg: "bg-yellow-100",
          iconColor: "text-yellow-600",
          lineColor: "bg-yellow-500",
          pulse: true,
        };
      case "REJECTED":
        return {
          icon: X,
          bgColor: "bg-red-500",
          borderColor: "border-red-500",
          iconBg: "bg-red-100",
          iconColor: "text-red-600",
          lineColor: "bg-red-500",
        };
      default:
        return {
          icon: User,
          bgColor: "bg-gray-300",
          borderColor: "border-gray-300",
          iconBg: "bg-gray-100",
          iconColor: "text-gray-400",
          lineColor: "bg-gray-200",
        };
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {sortedSigners.map((signer, index) => {
          const statusInfo = getStatusInfo(signer.status);
          const StatusIcon = statusInfo.icon;

          return (
            <div
              key={signer.id}
              className="group relative"
              title={`${signer.user.name} - ${signer.status}`}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2",
                  statusInfo.borderColor,
                  statusInfo.iconBg,
                  statusInfo.pulse && "animate-pulse-subtle"
                )}
              >
                <StatusIcon className={cn("h-4 w-4", statusInfo.iconColor)} />
              </div>
              {/* Connector line */}
              {index < sortedSigners.length - 1 && (
                <div className={cn("absolute top-1/2 left-full h-0.5 w-2", statusInfo.lineColor)} />
              )}
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {signer.user.name}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 via-gray-200 to-gray-200" />

      <div className="space-y-0">
        {sortedSigners.map((signer, index) => {
          const isCurrentUser = signer.user.id === currentUserId;
          const isLast = index === sortedSigners.length - 1;
          const statusInfo = getStatusInfo(signer.status);
          const StatusIcon = statusInfo.icon;

          return (
            <div key={signer.id} className="relative pl-10 pb-6 last:pb-0">
              {/* Timeline node */}
              <div
                className={cn(
                  "absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white",
                  statusInfo.borderColor,
                  statusInfo.pulse && "animate-pulse-subtle"
                )}
              >
                <StatusIcon className={cn("h-4 w-4", statusInfo.iconColor)} />
              </div>

              {/* Progress line overlay */}
              {!isLast && signer.status === "SIGNED" && (
                <div className="absolute left-[15px] top-8 h-6 w-0.5 bg-green-500" />
              )}

              {/* Content card */}
              <div
                className={cn(
                  "rounded-lg border p-4 transition-all",
                  isCurrentUser && "border-primary bg-primary/5 shadow-sm",
                  signer.status === "ACTIVE" && !isCurrentUser && "border-yellow-200 bg-yellow-50/50",
                  signer.status === "SIGNED" && "border-green-200 bg-green-50/30"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Name and order */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted text-[10px] font-medium">
                        {signer.signingOrder}
                      </span>
                      <span className="font-semibold truncate">
                        {signer.user.name}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>

                    {/* Title & Email */}
                    <div className="mt-1 space-y-0.5">
                      {signer.user.title && (
                        <p className="text-sm text-muted-foreground">
                          {signer.user.title}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{signer.user.email}</span>
                      </div>
                    </div>

                    {/* Status message */}
                    <div className="mt-2 text-xs">
                      {signer.status === "SIGNED" && signer.signedAt && (
                        <span className="text-green-600">
                          Signed {formatDateTime(signer.signedAt)}
                        </span>
                      )}
                      {signer.status === "ACTIVE" && (
                        <span className="text-yellow-600 font-medium">
                          Awaiting signature...
                        </span>
                      )}
                      {signer.status === "REJECTED" && (
                        <span className="text-red-600">
                          Rejected the document
                        </span>
                      )}
                      {signer.status === "PENDING" && (
                        <span className="text-muted-foreground">
                          Waiting for previous signers
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <SignerStatusBadge status={signer.status} size="sm" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Simple progress summary
interface SignerProgressSummaryProps {
  signers: Signer[];
}

export function SignerProgressSummary({ signers }: SignerProgressSummaryProps) {
  const total = signers.length;
  const signed = signers.filter(s => s.status === "SIGNED").length;
  const active = signers.find(s => s.status === "ACTIVE");

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1.5">
        <div className="flex -space-x-1">
          {signers.slice(0, 3).map((signer) => {
            const statusInfo = getStatusInfo(signer.status);
            return (
              <div
                key={signer.id}
                className={cn(
                  "h-6 w-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-medium",
                  signer.status === "SIGNED" ? "bg-green-500 text-white" :
                  signer.status === "ACTIVE" ? "bg-yellow-500 text-white" :
                  "bg-gray-200 text-gray-600"
                )}
              >
                {signer.user.name.charAt(0)}
              </div>
            );
          })}
          {signers.length > 3 && (
            <div className="h-6 w-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600">
              +{signers.length - 3}
            </div>
          )}
        </div>
      </div>
      <div>
        <span className="font-medium">{signed}/{total}</span>
        <span className="text-muted-foreground ml-1">signed</span>
      </div>
      {active && (
        <div className="text-muted-foreground">
          • Waiting on <span className="font-medium text-foreground">{active.user.name.split(' ')[0]}</span>
        </div>
      )}
    </div>
  );
}

function getStatusInfo(status: AfeSignerStatus) {
  switch (status) {
    case "SIGNED":
      return { color: "green" };
    case "ACTIVE":
      return { color: "yellow" };
    case "REJECTED":
      return { color: "red" };
    default:
      return { color: "gray" };
  }
}
