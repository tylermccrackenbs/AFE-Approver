"use client";

import { Badge } from "@/components/ui/badge";
import { AfeStatus, AfeSignerStatus } from "@/types";
import {
  FileEdit,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  UserCheck,
  User,
  UserX,
  UserMinus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const afeStatusConfig: Record<
  AfeStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
    icon: React.ComponentType<{ className?: string }>;
    className?: string;
  }
> = {
  DRAFT: {
    label: "Draft",
    variant: "secondary",
    icon: FileEdit,
  },
  PENDING: {
    label: "Pending",
    variant: "warning",
    icon: Clock,
  },
  PARTIALLY_SIGNED: {
    label: "In Progress",
    variant: "info",
    icon: Loader2,
    className: "animate-pulse-subtle",
  },
  FULLY_SIGNED: {
    label: "Completed",
    variant: "success",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    variant: "destructive",
    icon: XCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    variant: "outline",
    icon: Ban,
  },
};

const signerStatusConfig: Record<
  AfeSignerStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
    icon: React.ComponentType<{ className?: string }>;
    className?: string;
  }
> = {
  PENDING: {
    label: "Waiting",
    variant: "secondary",
    icon: User,
  },
  ACTIVE: {
    label: "Active",
    variant: "warning",
    icon: Clock,
    className: "animate-pulse-subtle",
  },
  SIGNED: {
    label: "Signed",
    variant: "success",
    icon: UserCheck,
  },
  REJECTED: {
    label: "Rejected",
    variant: "destructive",
    icon: UserX,
  },
  SKIPPED: {
    label: "Skipped",
    variant: "outline",
    icon: UserMinus,
  },
};

interface AfeStatusBadgeProps {
  status: AfeStatus;
  showIcon?: boolean;
  size?: "sm" | "default";
}

export function AfeStatusBadge({ status, showIcon = true, size = "default" }: AfeStatusBadgeProps) {
  const config = afeStatusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "gap-1",
        size === "sm" && "text-[10px] px-2 py-0",
        config.className
      )}
    >
      {showIcon && <Icon className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />}
      {config.label}
    </Badge>
  );
}

interface SignerStatusBadgeProps {
  status: AfeSignerStatus;
  showIcon?: boolean;
  size?: "sm" | "default";
}

export function SignerStatusBadge({ status, showIcon = true, size = "default" }: SignerStatusBadgeProps) {
  const config = signerStatusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "gap-1",
        size === "sm" && "text-[10px] px-2 py-0",
        config.className
      )}
    >
      {showIcon && <Icon className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />}
      {config.label}
    </Badge>
  );
}

// Progress indicator for AFE
interface AfeProgressProps {
  signers: Array<{ status: AfeSignerStatus }>;
  className?: string;
}

export function AfeProgress({ signers, className }: AfeProgressProps) {
  const total = signers.length;
  const signed = signers.filter(s => s.status === "SIGNED").length;
  const percentage = total > 0 ? Math.round((signed / total) * 100) : 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {signed}/{total}
      </span>
    </div>
  );
}
