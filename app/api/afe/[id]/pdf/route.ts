import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readPdf } from "@/lib/storage";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { format } from "date-fns";

// GET /api/afe/[id]/pdf - Serve the PDF with optional rotation and signature preview
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const final = searchParams.get("final") === "true";
  const preview = searchParams.get("preview") === "true";
  // Rotation: 0, 90, 180, 270 - clockwise rotation to apply
  const rotateParam = searchParams.get("rotate");

  const afe = await prisma.afe.findUnique({
    where: { id: params.id },
    include: {
      signers: {
        where: { status: "SIGNED" },
        include: { user: true },
        orderBy: { signingOrder: "asc" },
      },
    },
  });

  if (!afe) {
    return NextResponse.json({ error: "AFE not found" }, { status: 404 });
  }

  let pdfBuffer: Buffer;
  let filename: string;

  if (final) {
    if (!afe.finalPdfUrl) {
      return NextResponse.json(
        { error: "Final signed PDF not available yet" },
        { status: 404 }
      );
    }
    pdfBuffer = await readPdf(afe.finalPdfUrl);
    filename = `${afe.afeName}-signed.pdf`;
  } else if (preview && afe.signers.length > 0) {
    // Generate preview with current signatures
    pdfBuffer = await generatePreviewPdf(afe);
    filename = `${afe.afeName}-preview.pdf`;
  } else {
    pdfBuffer = await readPdf(afe.originalPdfUrl);
    filename = `${afe.afeName}.pdf`;
  }

  try {
    // Apply rotation if requested
    if (rotateParam) {
      const rotationDegrees = parseInt(rotateParam, 10);
      if ([90, 180, 270].includes(rotationDegrees)) {
        pdfBuffer = await rotatePdf(pdfBuffer, rotationDegrees);
      }
    } else {
      // Auto-detect and fix rotation for landscape pages displayed as portrait
      pdfBuffer = await autoFixRotation(pdfBuffer);
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": preview ? "no-cache" : "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error serving PDF:", error);
    return NextResponse.json(
      { error: "Failed to load PDF" },
      { status: 500 }
    );
  }
}

interface SignedSigner {
  signatureImage: string | null;
  signatureX: number | null;
  signatureY: number | null;
  signatureWidth: number | null;
  signatureHeight: number | null;
  titleX: number | null;
  titleY: number | null;
  titleWidth: number | null;
  titleHeight: number | null;
  dateX: number | null;
  dateY: number | null;
  dateWidth: number | null;
  dateHeight: number | null;
  signedAt: Date | null;
  user: {
    name: string;
    title: string | null;
  };
}

interface AfeWithSigners {
  originalPdfUrl: string;
  signers: SignedSigner[];
}

/**
 * Generate a preview PDF with all current signatures embedded
 */
async function generatePreviewPdf(afe: AfeWithSigners): Promise<Buffer> {
  const originalPdfBytes = await readPdf(afe.originalPdfUrl);
  const pdfDoc = await PDFDocument.load(originalPdfBytes);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const DEFAULT_CONFIG = {
    maxSignatureWidth: 120,
    maxSignatureHeight: 40,
  };

  for (const signer of afe.signers) {
    // 1. Render Title
    if (signer.titleX != null && signer.titleY != null && signer.user.title) {
      try {
        const titleBoxWidth = signer.titleWidth || 150;
        const titleBoxHeight = signer.titleHeight || 20;

        let fontSize = 11;
        let textWidth = helvetica.widthOfTextAtSize(signer.user.title, fontSize);
        while (textWidth > titleBoxWidth - 4 && fontSize > 8) {
          fontSize--;
          textWidth = helvetica.widthOfTextAtSize(signer.user.title, fontSize);
        }

        const centerY = signer.titleY + (titleBoxHeight - fontSize) / 2;

        firstPage.drawText(signer.user.title, {
          x: signer.titleX + 2,
          y: centerY,
          size: fontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
        });
      } catch (error) {
        console.error(`Error embedding title for ${signer.user.name}:`, error);
      }
    }

    // 2. Render Signature
    if (signer.signatureX != null && signer.signatureY != null && signer.signatureImage) {
      try {
        const base64Data = signer.signatureImage.replace(/^data:image\/png;base64,/, "");
        const signatureBytes = Buffer.from(base64Data, "base64");
        const signatureImageEmbed = await pdfDoc.embedPng(signatureBytes);

        let drawX: number;
        let drawY: number;
        let drawWidth: number;
        let drawHeight: number;

        if (signer.signatureWidth && signer.signatureHeight) {
          const boxWidth = signer.signatureWidth;
          const boxHeight = signer.signatureHeight;

          const imgWidth = signatureImageEmbed.width;
          const imgHeight = signatureImageEmbed.height;
          const scale = Math.min(boxWidth / imgWidth, boxHeight / imgHeight);
          drawWidth = imgWidth * scale;
          drawHeight = imgHeight * scale;

          drawX = signer.signatureX;
          drawY = signer.signatureY + (boxHeight - drawHeight) / 2;
        } else {
          const imgWidth = signatureImageEmbed.width;
          const imgHeight = signatureImageEmbed.height;
          const scale = Math.min(
            DEFAULT_CONFIG.maxSignatureWidth / imgWidth,
            DEFAULT_CONFIG.maxSignatureHeight / imgHeight
          );
          drawWidth = imgWidth * scale;
          drawHeight = imgHeight * scale;
          drawX = signer.signatureX - drawWidth / 2;
          drawY = signer.signatureY - drawHeight / 2;
        }

        firstPage.drawImage(signatureImageEmbed, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight,
        });
      } catch (error) {
        console.error(`Error embedding signature for ${signer.user.name}:`, error);
      }
    }

    // 3. Render Date
    if (signer.dateX != null && signer.dateY != null && signer.signedAt) {
      try {
        const dateBoxWidth = signer.dateWidth || 80;
        const dateBoxHeight = signer.dateHeight || 20;

        const dateStr = format(signer.signedAt, "M/d/yyyy");

        let fontSize = 11;
        let textWidth = helvetica.widthOfTextAtSize(dateStr, fontSize);
        while (textWidth > dateBoxWidth - 4 && fontSize > 8) {
          fontSize--;
          textWidth = helvetica.widthOfTextAtSize(dateStr, fontSize);
        }

        const centerY = signer.dateY + (dateBoxHeight - fontSize) / 2;

        firstPage.drawText(dateStr, {
          x: signer.dateX + 2,
          y: centerY,
          size: fontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
        });
      } catch (error) {
        console.error(`Error embedding date for ${signer.user.name}:`, error);
      }
    } else if (signer.signedAt && !signer.dateX && signer.signatureX != null) {
      // Legacy fallback
      try {
        const dateStr = format(signer.signedAt, "M/d/yyyy");
        const sigWidth = signer.signatureWidth || DEFAULT_CONFIG.maxSignatureWidth;
        const sigHeight = signer.signatureHeight || DEFAULT_CONFIG.maxSignatureHeight;

        firstPage.drawText(dateStr, {
          x: (signer.signatureX || 0) + sigWidth + 10,
          y: (signer.signatureY || 0) + sigHeight / 2 - 5,
          size: 10,
          font: helvetica,
          color: rgb(0, 0, 0.5),
        });
      } catch (error) {
        console.error(`Error embedding legacy date for ${signer.user.name}:`, error);
      }
    }
  }

  const previewPdfBytes = await pdfDoc.save();
  return Buffer.from(previewPdfBytes);
}

/**
 * Rotate all pages in a PDF by the specified degrees (clockwise)
 */
async function rotatePdf(pdfBuffer: Buffer, rotationDegrees: number): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const currentRotation = page.getRotation().angle;
      const newRotation = (currentRotation + rotationDegrees) % 360;
      page.setRotation(degrees(newRotation));
    }

    const modifiedPdfBytes = await pdfDoc.save();
    return Buffer.from(modifiedPdfBytes);
  } catch (error) {
    console.error("Error rotating PDF:", error);
    return pdfBuffer;
  }
}

/**
 * Auto-detect pages that appear sideways and rotate them to be upright
 */
async function autoFixRotation(pdfBuffer: Buffer): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    let modified = false;

    for (const page of pages) {
      const { width, height } = page.getSize();
      const rotation = page.getRotation().angle;

      if (width > height * 1.2 && rotation === 0) {
        page.setRotation(degrees(270));
        modified = true;
      }
    }

    if (modified) {
      const modifiedPdfBytes = await pdfDoc.save();
      return Buffer.from(modifiedPdfBytes);
    }

    return pdfBuffer;
  } catch (error) {
    console.error("Error auto-fixing PDF rotation:", error);
    return pdfBuffer;
  }
}
