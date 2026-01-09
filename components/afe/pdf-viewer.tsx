"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

interface PdfViewerProps {
  url: string;
  downloadUrl?: string;
  filename?: string;
}

export function PdfViewer({ url, downloadUrl, filename = "document.pdf" }: PdfViewerProps) {
  const [error, setError] = useState(false);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = downloadUrl || url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openInNewTab = () => {
    window.open(url, "_blank");
  };

  if (error) {
    return (
      <div className="flex flex-col h-96 items-center justify-center rounded-lg border bg-muted gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Failed to load PDF document</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="outline" onClick={openInNewTab}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in New Tab
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-lg border bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium">{filename}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openInNewTab}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* PDF Display using iframe */}
      <div className="flex-1 bg-gray-100">
        <iframe
          src={url}
          className="w-full border-0"
          style={{ height: "calc(100vh - 180px)", minHeight: "600px" }}
          title={filename}
          onError={() => setError(true)}
        />
      </div>
    </div>
  );
}
