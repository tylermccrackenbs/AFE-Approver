// Type definitions for AFE Approval System
// Using string literal types since SQL Server doesn't support Prisma enums

export type UserRole = "ADMIN" | "SIGNER" | "VIEWER";
export type AfeStatus = "DRAFT" | "PENDING" | "PARTIALLY_SIGNED" | "FULLY_SIGNED" | "REJECTED" | "CANCELLED";
export type AfeSignerStatus = "PENDING" | "ACTIVE" | "SIGNED" | "REJECTED" | "SKIPPED";

// User types
export interface UserBasic {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface User extends UserBasic {
  azureAdId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// AFE types
export interface AfeBasic {
  id: string;
  afeName: string;
  afeNumber?: string | null;
  status: AfeStatus;
  createdAt: Date;
}

export interface Afe extends AfeBasic {
  originalPdfUrl: string;
  finalPdfUrl?: string | null;
  createdById: string;
  createdBy?: UserBasic;
  signers?: AfeSigner[];
  updatedAt: Date;
}

export interface AfeWithDetails extends Afe {
  createdBy: UserBasic;
  signers: AfeSignerWithUser[];
}

// AFE Signer types
export interface AfeSigner {
  id: string;
  afeId: string;
  userId: string;
  signingOrder: number;
  status: AfeSignerStatus;
  signedAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AfeSignerWithUser extends AfeSigner {
  user: UserBasic;
}

// Audit log types
export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: string | null;
  timestamp: Date;
  user?: UserBasic | null;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Form types
export interface CreateAfeInput {
  afeName: string;
  afeNumber?: string;
  pdfFile: File;
}

export interface AssignSignersInput {
  signers: {
    userId: string;
    signingOrder: number;
  }[];
}

export interface SignAfeInput {
  confirmed: boolean;
}

export interface RejectAfeInput {
  reason?: string;
}

// Status display helpers
export const AFE_STATUS_LABELS: Record<AfeStatus, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  PARTIALLY_SIGNED: "Partially Signed",
  FULLY_SIGNED: "Fully Signed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const AFE_STATUS_COLORS: Record<AfeStatus, string> = {
  DRAFT: "gray",
  PENDING: "yellow",
  PARTIALLY_SIGNED: "blue",
  FULLY_SIGNED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};

export const SIGNER_STATUS_LABELS: Record<AfeSignerStatus, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  SIGNED: "Signed",
  REJECTED: "Rejected",
  SKIPPED: "Skipped",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  SIGNER: "Signer",
  VIEWER: "Viewer",
};
