import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Upload directory - defaults to ./uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

/**
 * Ensure the upload directory exists
 */
async function ensureUploadDir(): Promise<void> {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Upload a PDF file to local storage
 * @param file - The file buffer
 * @param originalFilename - Original filename for reference
 * @returns The relative URL path to the uploaded file
 */
export async function uploadPdf(
  file: Buffer,
  originalFilename: string
): Promise<string> {
  await ensureUploadDir();

  // Generate unique filename
  const ext = path.extname(originalFilename) || ".pdf";
  const uniqueFilename = `${uuidv4()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, uniqueFilename);

  // Write file
  await fs.writeFile(filePath, file);

  // Return the relative URL (to be served by the API)
  return `/api/uploads/${uniqueFilename}`;
}

/**
 * Get the absolute file path for a stored PDF
 * @param relativePath - The relative URL path (e.g., /api/uploads/xxx.pdf)
 * @returns The absolute file path
 */
export function getFilePath(relativePath: string): string {
  const filename = path.basename(relativePath);
  return path.join(UPLOAD_DIR, filename);
}

/**
 * Read a PDF file from storage
 * @param relativePath - The relative URL path
 * @returns The file buffer
 */
export async function readPdf(relativePath: string): Promise<Buffer> {
  const filePath = getFilePath(relativePath);
  return fs.readFile(filePath);
}

/**
 * Delete a PDF file from storage
 * @param relativePath - The relative URL path
 */
export async function deletePdf(relativePath: string): Promise<void> {
  const filePath = getFilePath(relativePath);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error("Failed to delete file:", error);
  }
}

/**
 * Check if a file exists
 * @param relativePath - The relative URL path
 * @returns boolean
 */
export async function fileExists(relativePath: string): Promise<boolean> {
  const filePath = getFilePath(relativePath);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a buffer is a PDF
 * @param buffer - File buffer to check
 * @returns boolean
 */
export function isPdfBuffer(buffer: Buffer): boolean {
  // PDF files start with %PDF-
  const pdfMagicNumber = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
  return buffer.subarray(0, 5).equals(pdfMagicNumber);
}
