"use client";

import { useRef, useState, useEffect } from "react";
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
  width = 400,
  height = 150,
}: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [useSaved, setUseSaved] = useState(!!initialSignature);

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

      <div className="border-2 border-dashed rounded-lg bg-white overflow-hidden">
        <SignatureCanvas
          ref={sigCanvas}
          canvasProps={{
            width,
            height,
            className: "signature-canvas",
            style: { width: "100%", height: `${height}px` },
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
