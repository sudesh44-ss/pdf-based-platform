import { OCRPage, OCRStatus } from '../types/database';

export interface OcrProcessingResult {
  success: boolean;
  text?: string;
  confidence?: number;
  words?: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[];
  error?: string;
}

export class OcrEngine {
  private static instance: OcrEngine;
  private worker: any = null;
  private isInitializing = false;

  public static getInstance(): OcrEngine {
    if (!OcrEngine.instance) {
      OcrEngine.instance = new OcrEngine();
    }
    return OcrEngine.instance;
  }

  /**
   * Recognizes text from a canvas or image blob using Tesseract.js
   * Runs client-side or server-side without blocking reader rendering.
   */
  public async recognizePage(
    imageSource: string | HTMLCanvasElement | Blob,
    language = 'eng',
    onProgress?: (progress: number) => void
  ): Promise<OcrProcessingResult> {
    try {
      const { createWorker } = await import('tesseract.js');

      const worker = await createWorker(language, 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text' && onProgress && typeof m.progress === 'number') {
            onProgress(Math.round(m.progress * 100));
          }
        },
      });

      const ret = await worker.recognize(imageSource);
      await worker.terminate();

      const text = ret.data.text || '';
      const confidence = ret.data.confidence || 0;
      const rawWords = (ret.data as any).words || [];
      const words = rawWords.map((w: any) => ({
        text: w.text,
        bbox: {
          x0: w.bbox.x0,
          y0: w.bbox.y0,
          x1: w.bbox.x1,
          y1: w.bbox.y1,
        },
      }));

      return {
        success: true,
        text,
        confidence,
        words,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'OCR extraction failed',
      };
    }
  }

  /**
   * Fallback simulator for unit tests or SSR environments where canvas isn't available
   */
  public simulatePageOcr(pageNumber: number): OcrProcessingResult {
    const sampleExtracts: Record<number, string> = {
      1: 'Modern Distributed Systems Architecture. Chapter 1: Principles of Fault-Tolerant State Machines. Consensus algorithms and CAP theorem.',
      2: 'Raft Consensus Protocol & Heartbeats. Leader election invariants. AppendEntries RPC verification.',
      3: 'Code Focus Mode: Distributed Lock Implementation in TypeScript. Lease management and fencing tokens.',
      4: 'Saga Pattern vs Two-Phase Commit. Orchestration and compensating transactions.',
      5: 'High-Throughput Storage & Backup Architecture. Telegram Cloud Persistence and SHA-256 integrity checks.',
    };

    return {
      success: true,
      text: sampleExtracts[pageNumber] || `Extracted OCR text for page ${pageNumber}.`,
      confidence: 94.5,
      words: [],
    };
  }
}

export const ocrEngine = OcrEngine.getInstance();
