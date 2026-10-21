import { describe, it, expect } from 'vitest';
import { ocrEngine } from './engine';

describe('OCR Pipeline & Extraction', () => {
  it('simulates page-level OCR text extraction', () => {
    const page1Result = ocrEngine.simulatePageOcr(1);
    expect(page1Result.success).toBe(true);
    expect(page1Result.text).toContain('Distributed Systems Architecture');
    expect(page1Result.confidence).toBeGreaterThan(90);

    const page3Result = ocrEngine.simulatePageOcr(3);
    expect(page3Result.success).toBe(true);
    expect(page3Result.text).toContain('Distributed Lock');
  });
});
