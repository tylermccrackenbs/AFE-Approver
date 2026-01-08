"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser, Check, RotateCcw } from "lucide-react";

interface SignaturePadProps {
  onSignatureChange: (signatureDataUrl: string | null) => void;
  initialSignature?: string | null;
  width?: number;
  height?: number;
}

export function SignaturePad({
  onSignatureChange,
  initialSignature,
  width,
  height = 150,
}: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [useSaved, setUseSaved] = useState(!!initialSignature);
  const [canvasWidth, setCanvasWidth] = useState(width || 400);

  // Resize canvas to fit container
  const updateCanvasSize = useCallback(() => {
    if (containerRef.current && !width) {
      const containerWidth = containerRef.current.offsetWidth;
      setCanvasWidth(Math.max(containerWidth - 4, 280)); // min 280px, subtract border
    }
  }, [width]);

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [updateCanvasSize]);

  useEffect(() => {
    // If we have an initial signature and want to use it, notify parent
    if (initialSignature && useSaved) {
      onSignatureChange(initialSignature);
    }
  }, [initialSignature, useSaved, onSignatureChange]);

  const handleClear = () => {
    sigCanvas.current?.clear();
    setIsEmpty(true);
    setUseSaved(false);
    onSignatureChange(null);
  };

  const handleEnd = () => {
    if (sigCanvas.current) {
      const dataUrl = sigCanvas.current.toDataURL("image/png");
      setIsEmpty(sigCanvas.current.isEmpty());
      setUseSaved(false);
      if (!sigCanvas.current.isEmpty()) {
        onSignatureChange(dataUrl);
      }
    }
  };

  const handleUseSaved = () => {
    setUseSaved(true);
    if (initialSignature) {
      onSignatureChange(initialSignature);
    }
  };

  const handleDrawNew = () => {
    setUseSaved(false);
    sigCanvas.current?.clear();
    setIsEmpty(true);
    onSignatureChange(null);
  };

  // Show saved signature preview
  if (useSaved && initialSignature) {
    return (
      <div className="space-y-3">
        <div className="text-sm font-medium">Your Saved Signature:</div>
        <div className="border rounded-lg p-4 bg-white flex justify-center">
          <img
            src={initialSignature}
            alt="Saved signature"
            className="max-h-[100px]"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDrawNew}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Draw New Signature
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {initialSignature ? "Draw New Signature:" : "Sign Below:"}
        </div>
        <div className="flex gap-2">
          {initialSignature && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseSaved}
            >
              <Check className="h-4 w-4 mr-2" />
              Use Saved
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={isEmpty}
          >
            <Eraser className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="border-2 border-dashed rounded-lg bg-white overflow-hidden touch-none">
        <SignatureCanvas
          ref={sigCanvas}
          canvasProps={{
            width: canvasWidth,
            height,
            className: "signature-canvas touch-none",
            style: { width: "100%", height: `${height}px`, touchAction: "none" },
          }}
          backgroundColor="rgba(255,255,255,0)"
          penColor="black"
          onEnd={handleEnd}
        />
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Use your mouse or finger to sign above
      </p>
    </div>
  );
}
