"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SignaturePad } from "./signature-pad";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { X, Check, RotateCcw, MousePointer2, AlertCircle, Loader2 } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

interface SignatureBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SignaturePlacementProps {
  pdfUrl: string;
  afeName: string;
  onSign: (signatureImage: string, x: number, y: number, width?: number, height?: number) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  predefinedBox?: SignatureBox; // If admin pre-placed the signature box
}

interface PlacedSignature {
  x: number; // screen X (top-left)
  y: number; // screen Y (top-left)
  width: number; // screen width
  height: number; // screen height
  pdfX: number; // PDF coordinate X (bottom-left of signature)
  pdfY: number; // PDF coordinate Y (bottom-left of signature)
  pdfWidth: number; // PDF width
  pdfHeight: number; // PDF height
}

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
}

export function SignaturePlacement({
  pdfUrl,
  afeName,
  onSign,
  onCancel,
  isLoading = false,
  predefinedBox,
}: SignaturePlacementProps) {
  // If we have a predefined box, skip placement step
  const hasPredefinedBox = !!predefinedBox;
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [loadingSignature, setLoadingSignature] = useState(true);
  const [placedSignature, setPlacedSignature] = useState<PlacedSignature | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saveSignature, setSaveSignature] = useState(true);
  const [step, setStep] = useState<"signature" | "placement" | "confirm">("signature");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch PDF as blob to avoid CORS issues
  useEffect(() => {
    let blobUrl: string | null = null;

    const fetchPdf = async () => {
      setLoadingPdf(true);
      setPdfError(null);
      try {
        const response = await fetch(pdfUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status}`);
        }
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(blobUrl);
      } catch (error) {
        console.error("Error fetching PDF:", error);
        setPdfError(error instanceof Error ? error.message : "Failed to load PDF");
      } finally {
        setLoadingPdf(false);
      }
    };
    fetchPdf();

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [pdfUrl]);

  // Fetch saved signature on mount
  useEffect(() => {
    fetchSavedSignature();
  }, []);

  const fetchSavedSignature = async () => {
    setLoadingSignature(true);
    try {
      const res = await fetch("/api/users/signature");
      const data = await res.json();
      if (data.success && data.data.signatureImage) {
        setSavedSignature(data.data.signatureImage);
        setSignatureImage(data.data.signatureImage);
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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onPageLoadSuccess = (page: { width: number; height: number; originalWidth: number; originalHeight: number }) => {
    setPdfDimensions({ width: page.originalWidth, height: page.originalHeight });
  };

  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (step !== "placement" || !pdfDimensions || !signatureImage) return;

    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert to PDF coordinates using CSS dimensions (not canvas pixels which can be 2x on high-DPI)
    const scaleX = pdfDimensions.width / rect.width;
    const scaleY = pdfDimensions.height / rect.height;
    const pdfX = clickX * scaleX;
    const pdfY = pdfDimensions.height - (clickY * scaleY);

    setPlacedSignature({
      x: clickX,
      y: clickY,
      width: sigPreviewWidth,
      height: sigPreviewHeight,
      pdfX: Math.round(pdfX),
      pdfY: Math.round(pdfY),
      pdfWidth: sigPreviewWidth * scaleX,
      pdfHeight: sigPreviewHeight * scaleY,
    });
    setStep("confirm");
  };

  const handleConfirmSign = async () => {
    if (!signatureImage || !confirmed) return;

    // For predefined boxes, use the predefined coordinates
    // For user-placed signatures, use the placed coordinates
    const signX = hasPredefinedBox ? predefinedBox!.x : placedSignature?.pdfX;
    const signY = hasPredefinedBox ? predefinedBox!.y : placedSignature?.pdfY;
    const signWidth = hasPredefinedBox ? predefinedBox!.width : placedSignature?.pdfWidth;
    const signHeight = hasPredefinedBox ? predefinedBox!.height : placedSignature?.pdfHeight;

    if (signX === undefined || signY === undefined) return;

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

    await onSign(signatureImage, signX, signY, signWidth, signHeight);
  };

  const resetPlacement = () => {
    setPlacedSignature(null);
    setStep("placement");
    setConfirmed(false);
  };

  const proceedToPlacement = () => {
    if (signatureImage) {
      // If we have a predefined box, skip placement and go to confirm
      if (hasPredefinedBox) {
        setStep("confirm");
      } else {
        setStep("placement");
      }
    }
  };

  // Signature dimensions for preview (scaled to look reasonable)
  const sigPreviewWidth = 120;
  const sigPreviewHeight = 40;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between bg-background">
        <div>
          <h2 className="font-semibold">Sign AFE: {afeName}</h2>
          <p className="text-sm text-muted-foreground">
            {step === "signature" && "Step 1: Draw or use your saved signature"}
            {step === "placement" && "Step 2: Click on the PDF where you want your signature"}
            {step === "confirm" && (hasPredefinedBox ? "Step 2: Confirm your signature" : "Step 3: Confirm your signature placement")}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} disabled={isLoading}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* PDF Area */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          {loadingPdf && (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading PDF...</span>
            </div>
          )}

          {pdfError && (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <p className="text-red-600">{pdfError}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )}

          {pdfBlobUrl && !pdfError && (
          <div
            ref={containerRef}
            className={`inline-block relative ${step === "placement" ? "cursor-crosshair" : ""}`}
            onClick={handlePdfClick}
          >
            <Document
              file={pdfBlobUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(error) => {
                console.error("PDF load error:", error);
                setPdfError("Failed to render PDF");
              }}
              loading={
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                onLoadSuccess={onPageLoadSuccess}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={800}
              />
            </Document>

            {/* Signature preview overlay */}
            {placedSignature && signatureImage && (
              <div
                className="absolute pointer-events-none border-2 border-blue-500 bg-white/80"
                style={{
                  left: placedSignature.x - sigPreviewWidth / 2,
                  top: placedSignature.y - sigPreviewHeight / 2,
                  width: sigPreviewWidth,
                  height: sigPreviewHeight,
                }}
              >
                <img
                  src={signatureImage}
                  alt="Signature preview"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Click indicator for placement mode */}
            {step === "placement" && !placedSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-blue-500/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
                  <MousePointer2 className="h-5 w-5" />
                  Click where you want to place your signature
                </div>
              </div>
            )}
          </div>
          )}

          {/* Page navigation */}
          {numPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
              >
                Previous
              </Button>
              <span className="px-3 py-1 text-sm">
                Page {pageNumber} of {numPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-96 border-l bg-background p-4 overflow-auto">
          {step === "signature" && (
            <div className="space-y-4">
              <h3 className="font-medium">Your Signature</h3>
              {loadingSignature ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : (
                <SignaturePad
                  onSignatureChange={handleSignatureChange}
                  initialSignature={savedSignature}
                  width={350}
                  height={120}
                />
              )}

              {signatureImage && signatureImage !== savedSignature && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="save-signature"
                    checked={saveSignature}
                    onCheckedChange={(checked) => setSaveSignature(checked === true)}
                  />
                  <Label htmlFor="save-signature" className="text-sm">
                    Save this signature for future use
                  </Label>
                </div>
              )}

              <Button
                className="w-full"
                onClick={proceedToPlacement}
                disabled={!signatureImage}
              >
                {hasPredefinedBox ? "Continue to Confirm" : "Continue to Placement"}
              </Button>
            </div>
          )}

          {step === "placement" && (
            <div className="space-y-4">
              <h3 className="font-medium">Place Your Signature</h3>
              <Card className="p-3">
                <p className="text-sm text-muted-foreground mb-2">Your signature:</p>
                {signatureImage && (
                  <img
                    src={signatureImage}
                    alt="Your signature"
                    className="h-12 object-contain border rounded"
                  />
                )}
              </Card>
              <p className="text-sm text-muted-foreground">
                Click on the PDF document where you want to place your signature.
                Usually this is in the APPROVALS section.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setStep("signature")}>
                Change Signature
              </Button>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4">
              <h3 className="font-medium">Confirm Signature</h3>
              <Card className="p-3">
                <p className="text-sm text-muted-foreground mb-2">Signature preview:</p>
                {signatureImage && (
                  <img
                    src={signatureImage}
                    alt="Your signature"
                    className="h-12 object-contain border rounded"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Position: ({placedSignature?.pdfX}, {placedSignature?.pdfY})
                </p>
              </Card>

              <div className="flex items-start space-x-3 pt-2 border-t">
                <Checkbox
                  id="confirm"
                  checked={confirmed}
                  onCheckedChange={(checked) => setConfirmed(checked === true)}
                />
                <Label htmlFor="confirm" className="text-sm leading-relaxed">
                  I have reviewed and approve this AFE. I understand that my
                  electronic signature will be recorded with my name, timestamp,
                  and IP address.
                </Label>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={resetPlacement}
                  disabled={isLoading}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reposition
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmSign}
                  disabled={!confirmed || isLoading}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {isLoading ? "Signing..." : "Sign AFE"}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            <Button variant="outline" className="w-full" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
