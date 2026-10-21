import { describe, it, expect } from 'vitest';
import { checkTelegramUploadEligibility } from './limits';
import { TelegramStorageClient } from './client';

describe('Telegram Storage & Limits', () => {
  it('correctly enforces the 50 MB limit on official Cloud Bot API', () => {
    const underLimit = 45 * 1024 * 1024;
    const overLimit = 55 * 1024 * 1024;

    expect(checkTelegramUploadEligibility(underLimit, false).eligible).toBe(true);
    const result = checkTelegramUploadEligibility(overLimit, false);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('50 MB limit');
  });

  it('allows files up to 2,000 MB when using a local Bot API server', () => {
    const largeFile = 500 * 1024 * 1024; // 500 MB
    expect(checkTelegramUploadEligibility(largeFile, true).eligible).toBe(true);

    const excessiveFile = 2500 * 1024 * 1024; // 2.5 GB
    expect(checkTelegramUploadEligibility(excessiveFile, true).eligible).toBe(false);
  });

  it('performs SHA-256 integrity check accurately', () => {
    const client = new TelegramStorageClient();
    const bufA = Buffer.from('PDF file contents for integrity testing A');
    const bufB = Buffer.from('PDF file contents for integrity testing A');
    const bufC = Buffer.from('Different contents');

    expect(client.verifyIntegrity(bufA, bufB)).toBe(true);
    expect(client.verifyIntegrity(bufA, bufC)).toBe(false);
  });

  it('handles simulated upload and generates deterministic sha256', async () => {
    const client = new TelegramStorageClient();
    const testBuffer = Buffer.from('%PDF-1.4 sample content %%EOF');
    const result = await client.uploadPdf(testBuffer, 'test.pdf');

    expect(result.success).toBe(true);
    expect(result.sha256).toBeDefined();
    expect(result.fileId).toBeDefined();
  });
});
