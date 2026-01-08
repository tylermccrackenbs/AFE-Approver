"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AfeStatusBadge } from "@/components/afe/afe-status-badge";
import { SignerList } from "@/components/afe/signer-list";
import { RejectDialog } from "@/components/afe/sign-dialog";
import { SignaturePlacement } from "@/components/afe/signature-placement";
import { PdfViewer } from "@/components/afe/pdf-viewer";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Download,
  Edit,
  FileText,
  CheckCircle,
  XCircle,
  Bell,
  Loader2,
  Trash2,
  Ban,
} from "lucide-react";
import { SkeletonAfeDetail } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AfeStatus, AfeSignerStatus } from "@/types";

interface AfeDetails {
  id: string;
  afeName: string;
  afeNumber?: string;
  status: AfeStatus;
  originalPdfUrl: string;
  finalPdfUrl?: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  signers: Array<{
    id: string;
    signingOrder: number;
    status: AfeSignerStatus;
    signedAt?: string;
    signatureX?: number;
    signatureY?: number;
    signatureWidth?: number;
    signatureHeight?: number;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

export default function AfeViewerPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const params = useParams();
  const router = useRouter();
  const [afe, setAfe] = useState<AfeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchAfe();
  }, [params.id]);

  const fetchAfe = async () => {
    try {
      const res = await fetch(`/api/afe/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setAfe(data.data);
      }
    } catch (error) {
      console.error("Error fetching AFE:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async (signatureImage: string, x: number, y: number, width?: number, height?: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/afe/${params.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          signatureImage,
          signatureX: x,
          signatureY: y,
          signatureWidth: width,
          signatureHeight: height,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSignDialogOpen(false);
        toast.success("Signature recorded", "Your signature has been successfully added to this AFE.");
        fetchAfe();
      } else {
        toast.error("Signing failed", data.error || "Failed to sign AFE");
      }
    } catch (error) {
      console.error("Error signing AFE:", error);
      toast.error("Signing failed", "An unexpected error occurred while signing.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reason?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/afe/${params.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        setRejectDialogOpen(false);
        toast.warning("AFE rejected", "This AFE has been rejected and the creator has been notified.");
        fetchAfe();
      } else {
        toast.error("Rejection failed", data.error || "Failed to reject AFE");
      }
    } catch (error) {
      console.error("Error rejecting AFE:", error);
      toast.error("Rejection failed", "An unexpected error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const sendReminder = async () => {
    setReminderLoading(true);
    try {
      const res = await fetch(`/api/afe/${params.id}/remind`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Reminder sent", data.message);
      } else {
        toast.error("Reminder failed", data.error || "Failed to send reminder");
      }
    } catch (error) {
      console.error("Error sending reminder:", error);
      toast.error("Reminder failed", "An unexpected error occurred.");
    } finally {
      setReminderLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/afe/${params.id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setCancelDialogOpen(false);
        toast.info("AFE cancelled", "The approval process has been stopped.");
        fetchAfe();
      } else {
        toast.error("Cancellation failed", data.error || "Failed to cancel AFE");
      }
    } catch (error) {
      console.error("Error cancelling AFE:", error);
      toast.error("Cancellation failed", "An unexpected error occurred.");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/afe/${params.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("AFE deleted", "The AFE has been permanently deleted.");
        router.push("/afe");
      } else {
        toast.error("Deletion failed", data.error || "Failed to delete AFE");
      }
    } catch (error) {
      console.error("Error deleting AFE:", error);
      toast.error("Deletion failed", "An unexpected error occurred.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return <SkeletonAfeDetail />;
  }

  if (!afe) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold">AFE Not Found</h2>
        <p className="text-muted-foreground mt-2">
          The requested AFE could not be found or you don&apos;t have access.
        </p>
        <Link href="/afe">
          <Button className="mt-4">Back to AFE List</Button>
        </Link>
      </div>
    );
  }

  const isAdmin = user?.role === "ADMIN";
  const currentUserSigner = afe.signers.find(
    (s) => s.user.id === user?.id
  );
  const isActiveSigner = currentUserSigner?.status === "ACTIVE";
  const canEdit = isAdmin && afe.status === "DRAFT";
  const activeSigner = afe.signers.find((s) => s.status === "ACTIVE");
  const canSendReminder = isAdmin && activeSigner && afe.status === "PENDING";
  const canCancel = isAdmin && !["FULLY_SIGNED", "CANCELLED"].includes(afe.status);
  const canDelete = isAdmin && afe.status === "DRAFT";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/afe">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{afe.afeName}</h1>
            {afe.afeNumber && (
              <p className="text-muted-foreground">#{afe.afeNumber}</p>
            )}
          </div>
          <AfeStatusBadge status={afe.status} />
        </div>

        <div className="flex items-center gap-2">
          {afe.finalPdfUrl && (
            <a href={`/api/afe/${afe.id}/pdf?final=true`} download>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Signed PDF
              </Button>
            </a>
          )}
          {canEdit && (
            <Link href={`/afe/${afe.id}/edit`}>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit Signers
              </Button>
            </Link>
          )}
          {canCancel && !canDelete && (
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(true)}
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            >
              <Ban className="h-4 w-4 mr-2" />
              Cancel AFE
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PDF Viewer */}
        <div className="lg:col-span-2">
          {(() => {
            const hasSignedSigners = afe.signers.some((s) => s.status === "SIGNED");
            // Add timestamp to bust cache when signatures change
            const lastSignedAt = afe.signers
              .filter((s) => s.signedAt)
              .map((s) => new Date(s.signedAt!).getTime())
              .sort((a, b) => b - a)[0];
            const cacheKey = lastSignedAt || "";
            const pdfUrl = hasSignedSigners
              ? `/api/afe/${afe.id}/pdf?preview=true&t=${cacheKey}`
              : `/api/afe/${afe.id}/pdf`;
            return (
              <PdfViewer
                url={pdfUrl}
                downloadUrl={`/api/afe/${afe.id}/pdf`}
                filename={`${afe.afeName}.pdf`}
              />
            );
          })()}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          {isActiveSigner && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="text-lg">Your Turn to Sign</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Please review the document and then sign or reject.
                </p>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => setSignDialogOpen(true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Sign
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setRejectDialogOpen(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Created by:</span>
                <p className="font-medium">{afe.createdBy.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>
                <p>{formatDateTime(afe.createdAt)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <p className="capitalize">{afe.status.replace("_", " ").toLowerCase()}</p>
              </div>
              {canSendReminder && (
                <div className="pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={sendReminder}
                    disabled={reminderLoading}
                  >
                    {reminderLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Bell className="h-4 w-4 mr-2" />
                    )}
                    Send Reminder to {activeSigner?.user.name.split(" ")[0]}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Approval Chain</CardTitle>
            </CardHeader>
            <CardContent>
              {afe.signers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No signers assigned yet
                </p>
              ) : (
                <SignerList
                  signers={afe.signers}
                  currentUserId={user?.id}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Signature Placement Full-screen */}
      {signDialogOpen && currentUserSigner && (
        <SignaturePlacement
          pdfUrl={`/api/afe/${afe.id}/pdf`}
          afeName={afe.afeName}
          onSign={handleSign}
          onCancel={() => setSignDialogOpen(false)}
          isLoading={actionLoading}
          predefinedBox={
            currentUserSigner.signatureX !== undefined &&
            currentUserSigner.signatureY !== undefined &&
            currentUserSigner.signatureWidth !== undefined &&
            currentUserSigner.signatureHeight !== undefined
              ? {
                  x: currentUserSigner.signatureX,
                  y: currentUserSigner.signatureY,
                  width: currentUserSigner.signatureWidth,
                  height: currentUserSigner.signatureHeight,
                }
              : undefined
          }
        />
      )}

      {/* Dialogs */}
      <RejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        afeName={afe.afeName}
        onReject={handleReject}
        isLoading={actionLoading}
      />

      {/* Cancel AFE Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel AFE</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel <strong>{afe.afeName}</strong>?
              This will stop the approval process. The AFE can be viewed but no further signatures will be collected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Active</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelLoading}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {cancelLoading ? "Cancelling..." : "Cancel AFE"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete AFE Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete AFE</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{afe.afeName}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
