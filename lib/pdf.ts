import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/db";
import { uploadPdf, readPdf } from "@/lib/storage";
import { format } from "date-fns";

// Default signature dimensions (used if no box defined)
const DEFAULT_SIGNATURE_CONFIG = {
  maxSignatureWidth: 120,
  maxSignatureHeight: 40,
};

/**
 * Generate the final signed PDF with signatures, titles, and dates embedded at user-specified locations
 * @param afeId - The AFE ID
 * @returns The URL of the final signed PDF
 */
export async function generateFinalPdf(afeId: string): Promise<string> {
  // Fetch AFE with all signed signers
  const afe = await prisma.afe.findUnique({
    where: { id: afeId },
    include: {
      signers: {
        where: { status: "SIGNED" },
        include: { user: true },
        orderBy: { signingOrder: "asc" },
      },
      createdBy: true,
    },
  });

  if (!afe) {
    throw new Error("AFE not found");
  }

  // Read original PDF
  const originalPdfBytes = await readPdf(afe.originalPdfUrl);
  const pdfDoc = await PDFDocument.load(originalPdfBytes);

  // Get first page to embed signatures
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();

  console.log(`PDF dimensions: ${width}x${height}`);

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Embed each signer's elements at their specified locations
  for (const signer of afe.signers) {
    // 1. Render Title if title box is defined and user has a title
    if (signer.titleX != null && signer.titleY != null && signer.user.title) {
      try {
        const titleBoxWidth = signer.titleWidth || 150;
        const titleBoxHeight = signer.titleHeight || 20;

        // Calculate font size to fit in box (max 12pt, min 8pt)
        let fontSize = 11;
        let textWidth = helvetica.widthOfTextAtSize(signer.user.title, fontSize);
        while (textWidth > titleBoxWidth - 4 && fontSize > 8) {
          fontSize--;
          textWidth = helvetica.widthOfTextAtSize(signer.user.title, fontSize);
        }

        // Center text vertically in the box
        const textHeight = fontSize;
        const centerY = signer.titleY + (titleBoxHeight - textHeight) / 2;

        firstPage.drawText(signer.user.title, {
          x: signer.titleX + 2, // Small left padding
          y: centerY,
          size: fontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
        });

        console.log(`Embedded title "${signer.user.title}" for ${signer.user.name} at (${signer.titleX}, ${signer.titleY})`);
      } catch (error) {
        console.error(`Error embedding title for ${signer.user.name}:`, error);
      }
    }

    // 2. Render Signature if signature box is defined
    if (signer.signatureX != null && signer.signatureY != null && signer.signatureImage) {
      try {
        // Extract base64 data from data URL
        const base64Data = signer.signatureImage.replace(/^data:image\/png;base64,/, "");
        const signatureBytes = Buffer.from(base64Data, "base64");
        const signatureImageEmbed = await pdfDoc.embedPng(signatureBytes);

        // Use signature box dimensions if available, otherwise use defaults
        let drawX: number;
        let drawY: number;
        let drawWidth: number;
        let drawHeight: number;

        if (signer.signatureWidth && signer.signatureHeight) {
          // Use predefined signature box - fit signature inside it
          const boxWidth = signer.signatureWidth;
          const boxHeight = signer.signatureHeight;

          // Scale signature to fit in box while maintaining aspect ratio
          const imgWidth = signatureImageEmbed.width;
          const imgHeight = signatureImageEmbed.height;
          const scale = Math.min(boxWidth / imgWidth, boxHeight / imgHeight);
          drawWidth = imgWidth * scale;
          drawHeight = imgHeight * scale;

          // Left-align signature in the box, vertically centered
          drawX = signer.signatureX;
          drawY = signer.signatureY + (boxHeight - drawHeight) / 2;
        } else {
          // Legacy mode: center on click point with default max size
          const imgWidth = signatureImageEmbed.width;
          const imgHeight = signatureImageEmbed.height;
          const scale = Math.min(
            DEFAULT_SIGNATURE_CONFIG.maxSignatureWidth / imgWidth,
            DEFAULT_SIGNATURE_CONFIG.maxSignatureHeight / imgHeight
          );
          drawWidth = imgWidth * scale;
          drawHeight = imgHeight * scale;
          drawX = signer.signatureX - drawWidth / 2;
          drawY = signer.signatureY - drawHeight / 2;
        }

        // Draw signature image
        firstPage.drawImage(signatureImageEmbed, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight,
        });

        console.log(`Embedded signature for ${signer.user.name} at (${drawX}, ${drawY}) size ${drawWidth}x${drawHeight}`);
      } catch (error) {
        console.error(`Error embedding signature for ${signer.user.name}:`, error);
      }
    }

    // 3. Render Date if date box is defined and signed date exists
    if (signer.dateX != null && signer.dateY != null && signer.signedAt) {
      try {
        const dateBoxWidth = signer.dateWidth || 80;
        const dateBoxHeight = signer.dateHeight || 20;

        const dateStr = format(signer.signedAt, "M/d/yyyy");

        // Calculate font size to fit in box
        let fontSize = 11;
        let textWidth = helvetica.widthOfTextAtSize(dateStr, fontSize);
        while (textWidth > dateBoxWidth - 4 && fontSize > 8) {
          fontSize--;
          textWidth = helvetica.widthOfTextAtSize(dateStr, fontSize);
        }

        // Center text vertically in the box
        const textHeight = fontSize;
        const centerY = signer.dateY + (dateBoxHeight - textHeight) / 2;

        firstPage.drawText(dateStr, {
          x: signer.dateX + 2, // Small left padding
          y: centerY,
          size: fontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
        });

        console.log(`Embedded date "${dateStr}" for ${signer.user.name} at (${signer.dateX}, ${signer.dateY})`);
      } catch (error) {
        console.error(`Error embedding date for ${signer.user.name}:`, error);
      }
    } else if (signer.signedAt && !signer.dateX && signer.signatureX != null) {
      // Legacy fallback: draw date next to signature if no date box defined
      try {
        const dateStr = format(signer.signedAt, "M/d/yyyy");
        const sigWidth = signer.signatureWidth || DEFAULT_SIGNATURE_CONFIG.maxSignatureWidth;
        const sigHeight = signer.signatureHeight || DEFAULT_SIGNATURE_CONFIG.maxSignatureHeight;

        firstPage.drawText(dateStr, {
          x: (signer.signatureX || 0) + sigWidth + 10,
          y: (signer.signatureY || 0) + sigHeight / 2 - 5,
          size: 10,
          font: helvetica,
          color: rgb(0, 0, 0.5), // Dark blue to match handwritten style
        });
      } catch (error) {
        console.error(`Error embedding legacy date for ${signer.user.name}:`, error);
      }
    }
  }

  // Save PDF
  const finalPdfBytes = await pdfDoc.save();

  // Upload to storage
  const finalUrl = await uploadPdf(
    Buffer.from(finalPdfBytes),
    `final-${afe.id}.pdf`
  );

  // Update AFE with final PDF URL
  await prisma.afe.update({
    where: { id: afeId },
    data: { finalPdfUrl: finalUrl },
  });

  return finalUrl;
}

/**
 * Get PDF info (page count, etc.)
 * @param pdfBuffer - PDF file buffer
 * @returns PDF metadata
 */
export async function getPdfInfo(pdfBuffer: Buffer): Promise<{
  pageCount: number;
  title?: string;
  author?: string;
}> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  return {
    pageCount: pdfDoc.getPageCount(),
    title: pdfDoc.getTitle(),
    author: pdfDoc.getAuthor(),
  };
}
