"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ClickPoint {
  x: number;
  y: number;
  pdfX: number;
  pdfY: number;
  label?: string;
}

export default function PdfCoordsPage() {
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [clicks, setClicks] = useState<ClickPoint[]>([]);
  const [scale, setScale] = useState<number>(1);
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [afes, setAfes] = useState<Array<{ id: string; afeName: string }>>([]);

  // Fetch AFEs for dropdown
  useEffect(() => {
    fetch("/api/afe")
      .then((res) => res.json())
      .then((data) => setAfes(data.afes || []))
      .catch(console.error);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPdfFile(url);
      setClicks([]);
    }
  };

  const loadAfeUrl = (afeId: string) => {
    setPdfFile(`/api/afe/${afeId}/pdf`);
    setClicks([]);
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const onPageLoadSuccess = (page: { width: number; height: number; originalWidth: number; originalHeight: number }) => {
    setPdfDimensions({ width: page.originalWidth, height: page.originalHeight });
    // Calculate scale based on rendered vs original
    if (containerRef.current) {
      const canvas = containerRef.current.querySelector("canvas");
      if (canvas && page.originalWidth) {
        setScale(canvas.width / page.originalWidth);
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pdfDimensions) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const canvas = e.currentTarget.querySelector("canvas");
    if (!canvas) return;

    // Get click position relative to canvas
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert to PDF coordinates (PDF origin is bottom-left)
    const canvasScale = canvas.width / pdfDimensions.width;
    const pdfX = clickX / canvasScale;
    const pdfY = pdfDimensions.height - (clickY / canvasScale);

    const newClick: ClickPoint = {
      x: clickX,
      y: clickY,
      pdfX: Math.round(pdfX),
      pdfY: Math.round(pdfY),
    };

    setClicks((prev) => [...prev, newClick]);
  };

  const labelClick = (index: number, label: string) => {
    setClicks((prev) =>
      prev.map((c, i) => (i === index ? { ...c, label } : c))
    );
  };

  const clearClicks = () => setClicks([]);

  const copyConfig = () => {
    const sig1 = clicks.find((c) => c.label === "sig1");
    const sig2 = clicks.find((c) => c.label === "sig2");
    const sig3 = clicks.find((c) => c.label === "sig3");
    const date1 = clicks.find((c) => c.label === "date1");

    const config = `const SIGNATURE_CONFIG = {
  firstRowY: ${sig1?.pdfY || "??"},
  rowHeight: ${sig1 && sig2 ? Math.abs(sig1.pdfY - sig2.pdfY) : "??"},
  signatureX: ${sig1?.pdfX || "??"},
  dateX: ${date1?.pdfX || "??"},
  maxSignatureWidth: 90,
  maxSignatureHeight: 16,
  maxRows: 3,
};`;
    navigator.clipboard.writeText(config);
    alert("Config copied to clipboard!");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">PDF Coordinate Picker</h1>
      <p className="text-gray-600 mb-4">
        Click on the PDF to get coordinates for signature placement.
        PDF coordinates start from the <strong>bottom-left</strong> corner.
      </p>

      <div className="flex gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Upload PDF</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Or select AFE</label>
          <select
            onChange={(e) => e.target.value && loadAfeUrl(e.target.value)}
            className="border rounded p-2 min-w-[200px]"
          >
            <option value="">Select an AFE...</option>
            {afes.map((afe) => (
              <option key={afe.id} value={afe.id}>
                {afe.afeName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {pdfFile && (
        <div className="flex gap-6">
          <div
            ref={containerRef}
            className="border rounded relative cursor-crosshair"
            onClick={handleClick}
          >
            <Document file={pdfFile} onLoadSuccess={onDocumentLoadSuccess}>
              <Page
                pageNumber={pageNumber}
                onLoadSuccess={onPageLoadSuccess}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
            {/* Render click markers */}
            {clicks.map((click, i) => (
              <div
                key={i}
                className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-red-500 opacity-75 flex items-center justify-center text-white text-xs"
                style={{ left: click.x, top: click.y }}
              >
                {i + 1}
              </div>
            ))}
          </div>

          <div className="min-w-[300px]">
            <div className="mb-4">
              <strong>PDF Dimensions:</strong>{" "}
              {pdfDimensions
                ? `${pdfDimensions.width} x ${pdfDimensions.height}`
                : "Loading..."}
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span className="px-3 py-1">
                Page {pageNumber} / {numPages}
              </span>
              <button
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>

            <h3 className="font-bold mb-2">Click Points:</h3>
            {clicks.length === 0 && (
              <p className="text-gray-500 text-sm">Click on the PDF to mark positions</p>
            )}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {clicks.map((click, i) => (
                <div key={i} className="p-2 bg-gray-100 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">#{i + 1}</span>
                    <span>
                      X: <code className="bg-white px-1">{click.pdfX}</code>
                    </span>
                    <span>
                      Y: <code className="bg-white px-1">{click.pdfY}</code>
                    </span>
                  </div>
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {["sig1", "sig2", "sig3", "date1", "date2", "date3"].map(
                      (label) => (
                        <button
                          key={label}
                          onClick={() => labelClick(i, label)}
                          className={`px-2 py-0.5 text-xs rounded ${
                            click.label === label
                              ? "bg-blue-500 text-white"
                              : "bg-gray-200"
                          }`}
                        >
                          {label}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>

            {clicks.length > 0 && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={clearClicks}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded"
                >
                  Clear All
                </button>
                <button
                  onClick={copyConfig}
                  className="px-3 py-1 bg-green-500 text-white rounded"
                >
                  Copy Config
                </button>
              </div>
            )}

            <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
              <strong>Instructions:</strong>
              <ol className="list-decimal ml-4 mt-1 space-y-1">
                <li>Click on the <strong>Signature</strong> column for row 1 (EVP Ops)</li>
                <li>Label it as &quot;sig1&quot;</li>
                <li>Click on row 2 (CFO) signature area, label as &quot;sig2&quot;</li>
                <li>Click on row 3 (CEO) signature area, label as &quot;sig3&quot;</li>
                <li>Click on the <strong>Date</strong> column for row 1, label as &quot;date1&quot;</li>
                <li>Click &quot;Copy Config&quot; to get the settings</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
