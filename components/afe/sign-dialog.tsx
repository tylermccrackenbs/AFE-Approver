"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "./signature-pad";

interface SignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  afeName: string;
  onSign: (signatureImage: string) => Promise<void>;
  isLoading?: boolean;
}

export function SignDialog({
  open,
  onOpenChange,
  afeName,
  onSign,
  isLoading = false,
}: SignDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [saveSignature, setSaveSignature] = useState(true);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [loadingSignature, setLoadingSignature] = useState(false);

  // Fetch user's saved signature when dialog opens
  useEffect(() => {
    if (open) {
      fetchSavedSignature();
    }
  }, [open]);

  const fetchSavedSignature = async () => {
    setLoadingSignature(true);
    try {
      const res = await fetch("/api/users/signature");
      const data = await res.json();
      if (data.success && data.data.signatureImage) {
        setSavedSignature(data.data.signatureImage);
      }
    } catch (error) {
      console.error("Error fetching signature:", error);
    } finally {
      setLoadingSignature(false);
    }
  };

  const handleSignatureChange = useCallback((dataUrl: string | null) => {
    setSignatureImage(dataUrl);
  }, []);

  const handleSign = async () => {
    if (!confirmed || !signatureImage) return;

    // Save signature to profile if checkbox is checked
    if (saveSignature && signatureImage !== savedSignature) {
      try {
        await fetch("/api/users/signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signatureImage }),
        });
      } catch (error) {
        console.error("Error saving signature:", error);
      }
    }

    await onSign(signatureImage);
    setConfirmed(false);
    setSignatureImage(null);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmed(false);
      setSignatureImage(null);
    }
    onOpenChange(newOpen);
  };

  const canSign = confirmed && signatureImage;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sign AFE</DialogTitle>
          <DialogDescription>
            You are about to sign the AFE: <strong>{afeName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Signature Pad */}
          {loadingSignature ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <SignaturePad
              onSignatureChange={handleSignatureChange}
              initialSignature={savedSignature}
              width={450}
              height={150}
            />
          )}

          {/* Save signature checkbox */}
          {signatureImage && signatureImage !== savedSignature && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="save-signature"
                checked={saveSignature}
                onCheckedChange={(checked) => setSaveSignature(checked === true)}
              />
              <Label htmlFor="save-signature" className="text-sm">
                Save this signature to my profile for future use
              </Label>
            </div>
          )}

          {/* Confirmation checkbox */}
          <div className="flex items-start space-x-3 pt-2 border-t">
            <Checkbox
              id="confirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <Label htmlFor="confirm" className="text-sm leading-relaxed">
              I have reviewed and approve this AFE. I understand that my
              electronic signature will be recorded with my name, timestamp, and
              IP address.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSign} disabled={!canSign || isLoading}>
            {isLoading ? "Signing..." : "Sign AFE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  afeName: string;
  onReject: (reason?: string) => Promise<void>;
  isLoading?: boolean;
}

export function RejectDialog({
  open,
  onOpenChange,
  afeName,
  onReject,
  isLoading = false,
}: RejectDialogProps) {
  const [reason, setReason] = useState("");

  const handleReject = async () => {
    await onReject(reason || undefined);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject AFE</DialogTitle>
          <DialogDescription>
            You are about to reject the AFE: <strong>{afeName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label htmlFor="reason" className="text-sm font-medium">
            Reason for rejection (optional)
          </Label>
          <textarea
            id="reason"
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={3}
            placeholder="Enter reason for rejection..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isLoading}
          >
            {isLoading ? "Rejecting..." : "Reject AFE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
