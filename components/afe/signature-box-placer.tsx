"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Trash2, MousePointer2, Check, PenLine, User, Calendar } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

type BoxType = "signature" | "title" | "date";

interface PlacedBox {
  x: number;
  y: number;
  width: number;
  height: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
}

interface SignerWithBoxes {
  id: string;
  name: string;
  email: string;
  title?: string | null;
  order: number;
  signatureBox?: PlacedBox;
  titleBox?: PlacedBox;
  dateBox?: PlacedBox;
}

interface SignatureBoxPlacerProps {
  pdfFile: File;
  signers: SignerWithBoxes[];
  onSignersUpdate: (signers: SignerWithBoxes[]) => void;
  onComplete: () => void;
  onBack: () => void;
}

interface DragState {
  signerId: string;
  boxType: BoxType;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const BOX_CONFIG = {
  signature: {
    label: "Signature",
    icon: PenLine,
    color: { bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-600", fill: "rgba(59, 130, 246, 0.15)" },
  },
  title: {
    label: "Title",
    icon: User,
    color: { bg: "bg-green-500", border: "border-green-500", text: "text-green-600", fill: "rgba(34, 197, 94, 0.15)" },
  },
  date: {
    label: "Date",
    icon: Calendar,
    color: { bg: "bg-orange-500", border: "border-orange-500", text: "text-orange-600", fill: "rgba(249, 115, 22, 0.15)" },
  },
};

export function SignatureBoxPlacer({
  pdfFile,
  signers,
  onSignersUpdate,
  onComplete,
  onBack,
}: SignatureBoxPlacerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [selectedSigner, setSelectedSigner] = useState<string | null>(null);
  const [selectedBoxType, setSelectedBoxType] = useState<BoxType>("signature");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Create blob URL from file
  useEffect(() => {
    const url = URL.createObjectURL(pdfFile);
    setPdfBlobUrl(url);
    setLoadingPdf(false);
    return () => URL.revokeObjectURL(url);
  }, [pdfFile]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onPageLoadSuccess = (page: { originalWidth: number; originalHeight: number }) => {
    setPdfDimensions({ width: page.originalWidth, height: page.originalHeight });
  };

  const getCanvasCoords = (e: React.MouseEvent) => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selectedSigner || !pdfDimensions) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    setDragState({
      signerId: selectedSigner,
      boxType: selectedBoxType,
      startX: coords.x,
      startY: coords.y,
      currentX: coords.x,
      currentY: coords.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    setDragState({
      ...dragState,
      currentX: coords.x,
      currentY: coords.y,
    });
  };

  const handleMouseUp = () => {
    if (!dragState || !pdfDimensions) return;

    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;

    // Calculate box dimensions (ensure positive width/height)
    const x = Math.min(dragState.startX, dragState.currentX);
    const y = Math.min(dragState.startY, dragState.currentY);
    const width = Math.abs(dragState.currentX - dragState.startX);
    const height = Math.abs(dragState.currentY - dragState.startY);

    // Minimum box size
    if (width < 20 || height < 10) {
      setDragState(null);
      return;
    }

    // Convert to PDF coordinates using CSS dimensions
    const rect = canvas.getBoundingClientRect();
    const scaleX = pdfDimensions.width / rect.width;
    const scaleY = pdfDimensions.height / rect.height;
    const pdfX = x * scaleX;
    const pdfY = pdfDimensions.height - ((y + height) * scaleY); // Bottom-left Y
    const pdfWidth = width * scaleX;
    const pdfHeight = height * scaleY;

    const boxData: PlacedBox = { x, y, width, height, pdfX, pdfY, pdfWidth, pdfHeight };

    // Update signer with the appropriate box type
    const updatedSigners = signers.map((s) =>
      s.id === dragState.signerId
        ? {
            ...s,
            [dragState.boxType === "signature" ? "signatureBox" :
             dragState.boxType === "title" ? "titleBox" : "dateBox"]: boxData,
          }
        : s
    );
    onSignersUpdate(updatedSigners);
    setDragState(null);

    // Auto-advance to next box type
    const signer = signers.find(s => s.id === dragState.signerId);
    if (signer) {
      if (dragState.boxType === "signature" && !signer.titleBox) {
        setSelectedBoxType("title");
      } else if (dragState.boxType === "title" && !signer.dateBox) {
        setSelectedBoxType("date");
      } else {
        setSelectedSigner(null);
        setSelectedBoxType("signature");
      }
    }
  };

  const removeBox = (signerId: string, boxType: BoxType) => {
    const boxKey = boxType === "signature" ? "signatureBox" :
                   boxType === "title" ? "titleBox" : "dateBox";
    const updatedSigners = signers.map((s) =>
      s.id === signerId ? { ...s, [boxKey]: undefined } : s
    );
    onSignersUpdate(updatedSigners);
  };

  const getSignerProgress = (signer: SignerWithBoxes) => {
    let count = 0;
    if (signer.signatureBox) count++;
    if (signer.titleBox) count++;
    if (signer.dateBox) count++;
    return count;
  };

  const allBoxesPlaced = signers.every(
    (s) => s.signatureBox && s.titleBox && s.dateBox
  );

  const totalBoxes = signers.length * 3;
  const placedBoxes = signers.reduce((acc, s) => acc + getSignerProgress(s), 0);

  // Get color for signer
  const getSignerColor = (index: number) => {
    const colors = [
      { bg: "bg-slate-600", border: "border-slate-600", text: "text-slate-700" },
      { bg: "bg-violet-600", border: "border-violet-600", text: "text-violet-700" },
      { bg: "bg-cyan-600", border: "border-cyan-600", text: "text-cyan-700" },
      { bg: "bg-rose-600", border: "border-rose-600", text: "text-rose-700" },
      { bg: "bg-amber-600", border: "border-amber-600", text: "text-amber-700" },
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="flex gap-6">
      {/* PDF Area */}
      <div className="flex-1">
        <div className="bg-gray-100 p-4 rounded-lg">
          {loadingPdf && (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading PDF...</span>
            </div>
          )}

          {pdfError && (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
              <p className="text-red-600">{pdfError}</p>
            </div>
          )}

          {pdfBlobUrl && !pdfError && (
            <div
              ref={containerRef}
              className={`inline-block relative ${selectedSigner ? "cursor-crosshair" : ""}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => setDragState(null)}
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
                  width={700}
                />
              </Document>

              {/* Placed boxes for all signers */}
              {signers.map((signer, signerIndex) => {
                const signerColor = getSignerColor(signerIndex);
                return (
                  <div key={signer.id}>
                    {/* Signature box */}
                    {signer.signatureBox && (
                      <div
                        className={`absolute border-2 ${BOX_CONFIG.signature.color.border} pointer-events-none`}
                        style={{
                          left: signer.signatureBox.x,
                          top: signer.signatureBox.y,
                          width: signer.signatureBox.width,
                          height: signer.signatureBox.height,
                          backgroundColor: BOX_CONFIG.signature.color.fill,
                        }}
                      >
                        <span className={`absolute -top-5 left-0 text-xs font-medium ${BOX_CONFIG.signature.color.text}`}>
                          {signer.order}. Sig
                        </span>
                      </div>
                    )}
                    {/* Title box */}
                    {signer.titleBox && (
                      <div
                        className={`absolute border-2 ${BOX_CONFIG.title.color.border} pointer-events-none`}
                        style={{
                          left: signer.titleBox.x,
                          top: signer.titleBox.y,
                          width: signer.titleBox.width,
                          height: signer.titleBox.height,
                          backgroundColor: BOX_CONFIG.title.color.fill,
                        }}
                      >
                        <span className={`absolute -top-5 left-0 text-xs font-medium ${BOX_CONFIG.title.color.text}`}>
                          {signer.order}. Title
                        </span>
                      </div>
                    )}
                    {/* Date box */}
                    {signer.dateBox && (
                      <div
                        className={`absolute border-2 ${BOX_CONFIG.date.color.border} pointer-events-none`}
                        style={{
                          left: signer.dateBox.x,
                          top: signer.dateBox.y,
                          width: signer.dateBox.width,
                          height: signer.dateBox.height,
                          backgroundColor: BOX_CONFIG.date.color.fill,
                        }}
                      >
                        <span className={`absolute -top-5 left-0 text-xs font-medium ${BOX_CONFIG.date.color.text}`}>
                          {signer.order}. Date
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Current drag preview */}
              {dragState && (
                <div
                  className={`absolute border-2 border-dashed ${BOX_CONFIG[dragState.boxType].color.border} pointer-events-none`}
                  style={{
                    left: Math.min(dragState.startX, dragState.currentX),
                    top: Math.min(dragState.startY, dragState.currentY),
                    width: Math.abs(dragState.currentX - dragState.startX),
                    height: Math.abs(dragState.currentY - dragState.startY),
                    backgroundColor: BOX_CONFIG[dragState.boxType].color.fill,
                  }}
                />
              )}

              {/* Instruction overlay */}
              {selectedSigner && !dragState && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`${BOX_CONFIG[selectedBoxType].color.bg} text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg`}>
                    <MousePointer2 className="h-5 w-5" />
                    Draw {BOX_CONFIG[selectedBoxType].label} box for {signers.find(s => s.id === selectedSigner)?.name}
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
      </div>

      {/* Sidebar */}
      <div className="w-96 space-y-4">
        <Card className="p-4">
          <h3 className="font-medium mb-2">Place Signature Boxes</h3>
          <p className="text-sm text-muted-foreground mb-4">
            For each signer, place their signature, title, and date boxes on the PDF.
          </p>

          {/* Progress */}
          <div className="mb-4 p-2 bg-muted rounded">
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span>{placedBoxes}/{totalBoxes} boxes</span>
            </div>
            <div className="h-2 bg-gray-200 rounded overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(placedBoxes / totalBoxes) * 100}%` }}
              />
            </div>
          </div>

          {/* Box type legend */}
          <div className="flex gap-2 mb-4 text-xs">
            {(Object.keys(BOX_CONFIG) as BoxType[]).map((type) => {
              const config = BOX_CONFIG[type];
              const Icon = config.icon;
              return (
                <div key={type} className={`flex items-center gap-1 ${config.color.text}`}>
                  <Icon className="h-3 w-3" />
                  {config.label}
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            {signers.map((signer, index) => {
              const signerColor = getSignerColor(index);
              const isSelected = selectedSigner === signer.id;
              const progress = getSignerProgress(signer);
              const isComplete = progress === 3;

              return (
                <div
                  key={signer.id}
                  className={`p-3 border rounded-lg transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : ""
                  } ${isComplete ? "border-green-300 bg-green-50" : ""}`}
                >
                  {/* Signer header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`w-6 h-6 rounded-full ${signerColor.bg} text-white text-xs flex items-center justify-center`}
                    >
                      {signer.order}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{signer.name}</p>
                      {signer.title && (
                        <p className="text-xs text-muted-foreground">{signer.title}</p>
                      )}
                    </div>
                    {isComplete && (
                      <Check className="h-5 w-5 text-green-500" />
                    )}
                  </div>

                  {/* Box buttons */}
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(BOX_CONFIG) as BoxType[]).map((boxType) => {
                      const config = BOX_CONFIG[boxType];
                      const Icon = config.icon;
                      const boxKey = boxType === "signature" ? "signatureBox" :
                                     boxType === "title" ? "titleBox" : "dateBox";
                      const hasBox = !!(signer as unknown as Record<string, unknown>)[boxKey];
                      const isActiveType = isSelected && selectedBoxType === boxType;

                      return (
                        <div key={boxType} className="flex items-center gap-1">
                          {hasBox ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeBox(signer.id, boxType)}
                              className={`h-7 px-2 ${config.color.text}`}
                            >
                              <Icon className="h-3 w-3 mr-1" />
                              <Check className="h-3 w-3 mr-1" />
                              <Trash2 className="h-3 w-3 text-red-400" />
                            </Button>
                          ) : (
                            <Button
                              variant={isActiveType ? "default" : "outline"}
                              size="sm"
                              className={`h-7 px-2 ${isActiveType ? "" : config.color.text}`}
                              onClick={() => {
                                if (isActiveType) {
                                  setSelectedSigner(null);
                                } else {
                                  setSelectedSigner(signer.id);
                                  setSelectedBoxType(boxType);
                                }
                              }}
                            >
                              <Icon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button
            onClick={onComplete}
            className="flex-1"
            disabled={!allBoxesPlaced}
          >
            {allBoxesPlaced ? "Continue" : `${placedBoxes}/${totalBoxes} placed`}
          </Button>
        </div>
      </div>
    </div>
  );
}
