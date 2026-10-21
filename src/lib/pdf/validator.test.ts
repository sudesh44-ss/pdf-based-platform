import { describe, it, expect } from 'vitest';
import { validatePdfBuffer } from './validator';

describe('PDF Validator', () => {
  it('rejects files without %PDF- magic bytes', () => {
    const invalidData = new TextEncoder().encode('Hello world, this is a plain text file that is long enough to test.');
    const result = validatePdfBuffer(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid PDF signature');
  });

  it('rejects files missing %%EOF trailer', () => {
    const truncatedPdf = new TextEncoder().encode(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages >>\nendobj\n'
    );
    const result = validatePdfBuffer(truncatedPdf);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('missing %%EOF');
  });

  it('validates a well-formed minimal PDF structure', () => {
    const validPdf = new TextEncoder().encode(
      '%PDF-1.4\n' +
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
      '3 0 obj\n<< /Type /Page >>\nendobj\n' +
      'xref\n0 4\n' +
      'trailer\n<< /Root 1 0 R >>\n' +
      'startxref\n150\n%%EOF'
    );
    const result = validatePdfBuffer(validPdf);
    expect(result.isValid).toBe(true);
    expect(result.pageCount).toBe(1);
    expect(result.version).toBe('1.4');
  });

  it('detects encrypted PDFs', () => {
    const encryptedPdf = new TextEncoder().encode(
      '%PDF-1.7\n' +
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
      '3 0 obj\n<< /Type /Page >>\nendobj\n' +
      '4 0 obj\n<< /Encrypt 5 0 R >>\nendobj\n' +
      'trailer\n<< /Root 1 0 R /Encrypt 4 0 R >>\n%%EOF'
    );
    const result = validatePdfBuffer(encryptedPdf);
    expect(result.isValid).toBe(true);
    expect(result.isEncrypted).toBe(true);
  });
});
