export interface PdfValidationResult {
  isValid: boolean;
  error?: string;
  pageCount?: number;
  isEncrypted?: boolean;
  version?: string;
  fileSize: number;
}

const MAX_PDF_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Validates a PDF file by inspecting its raw binary signature (%PDF-),
 * structural elements, size limits, and estimates/extracts page count.
 */
export function validatePdfBuffer(buffer: Uint8Array | Buffer): PdfValidationResult {
  const fileSize = buffer.length;

  if (fileSize > MAX_PDF_SIZE_BYTES) {
    return {
      isValid: false,
      fileSize,
      error: `File size exceeds the 100 MB limit (got ${(fileSize / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  // Convert header to string to check magic bytes %PDF-
  const headerSlice = buffer.slice(0, Math.min(1024, fileSize));
  const headerText = new TextDecoder('latin1').decode(headerSlice);

  const pdfMagicIndex = headerText.indexOf('%PDF-');
  if (pdfMagicIndex === -1) {
    return {
      isValid: false,
      fileSize,
      error: 'Invalid PDF signature: File does not start with %PDF- magic bytes.',
    };
  }

  if (fileSize < 64) {
    return {
      isValid: false,
      fileSize,
      error: 'Malformed PDF: File is truncated or too small to be a valid PDF document.',
    };
  }

  // Extract PDF version (e.g. 1.4, 1.7, 2.0)
  const versionMatch = headerText.slice(pdfMagicIndex).match(/%PDF-([0-9]+\.[0-9]+)/);
  const version = versionMatch ? versionMatch[1] : '1.4';

  // Check end of file for %%EOF marker (usually within last 2048 bytes)
  const trailerSlice = buffer.slice(Math.max(0, fileSize - 2048));
  const trailerText = new TextDecoder('latin1').decode(trailerSlice);

  const hasEof = trailerText.includes('%%EOF');
  if (!hasEof) {
    // Malformed or truncated PDF
    return {
      isValid: false,
      fileSize,
      version,
      error: 'Malformed PDF: File is truncated or missing %%EOF marker.',
    };
  }

  // Scan full text for encryption flag and /Type /Page objects
  const fullText = new TextDecoder('latin1').decode(buffer);
  const isEncrypted = /\/Encrypt\s+[0-9]+\s+[0-9]+\s+R/.test(fullText) || /\/Encrypt\b/.test(fullText);

  // Fast structural page count estimation
  // Matches '/Type /Page' or '/Type/Page', but avoids '/Type /Pages'
  const pageMatches = fullText.match(/\/Type\s*\/Page\b(?!\s*s)/g);
  let pageCount = pageMatches ? pageMatches.length : 1;

  // Secondary check: look for '/Count \d+' in /Pages object
  const countMatch = fullText.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
  if (countMatch && countMatch[1]) {
    const parsedCount = parseInt(countMatch[1], 10);
    if (!isNaN(parsedCount) && parsedCount > 0) {
      pageCount = parsedCount;
    }
  }

  return {
    isValid: true,
    fileSize,
    version,
    isEncrypted,
    pageCount: Math.max(1, pageCount),
  };
}
