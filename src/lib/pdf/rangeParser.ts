/**
 * RFC 7233 / RFC 9110 Compliant HTTP Byte-Range Parser and Response Helper.
 */

export interface ByteRangeResult {
  status: 200 | 206 | 416;
  start?: number;
  end?: number;
  chunkLength?: number;
  contentRange?: string;
  isRange: boolean;
}

/**
 * Parses and validates an HTTP Range header against total file length.
 *
 * Supported formats:
 * 1. Bounded range: `bytes=0-999`
 * 2. Open-ended range: `bytes=1000-`
 * 3. Suffix range: `bytes=-500` (last 500 bytes)
 *
 * Status outcomes:
 * - 200: No Range header provided, or invalid syntax that must be ignored per RFC 7233.
 * - 206: Satisfiable byte range.
 * - 416: Unsatisfiable range (start >= totalLength, end < start, suffix <= 0).
 */
export function parseHttpRange(
  rangeHeader: string | null | undefined,
  totalLength: number
): ByteRangeResult {
  // If no range header is provided, return 200 for full content
  if (!rangeHeader || typeof rangeHeader !== 'string' || !rangeHeader.trim()) {
    return {
      status: 200,
      isRange: false,
    };
  }

  // Must begin with "bytes=" prefix
  const match = /^bytes\s*=\s*(.+)$/i.exec(rangeHeader.trim());
  if (!match) {
    // RFC 7233: An origin server MUST ignore a Range header field that contains a range unit it does not understand
    return {
      status: 200,
      isRange: false,
    };
  }

  const rangeSpec = match[1].trim();
  // Support single range (first range if comma-separated)
  const firstSpec = rangeSpec.split(',')[0].trim();

  // If total length is 0, any byte range is unsatisfiable
  if (totalLength <= 0) {
    return {
      status: 416,
      contentRange: `bytes */${totalLength}`,
      isRange: true,
    };
  }

  // Pattern 1: Suffix range `bytes=-500` (last N bytes)
  const suffixMatch = /^-\s*(\d+)$/.exec(firstSpec);
  if (suffixMatch) {
    const suffixLength = parseInt(suffixMatch[1], 10);
    if (isNaN(suffixLength) || suffixLength <= 0) {
      return {
        status: 416,
        contentRange: `bytes */${totalLength}`,
        isRange: true,
      };
    }

    // RFC 7233: If suffix is greater than totalLength, use entire representation
    const safeLength = Math.min(suffixLength, totalLength);
    const start = totalLength - safeLength;
    const end = totalLength - 1;

    return {
      status: 206,
      start,
      end,
      chunkLength: end - start + 1,
      contentRange: `bytes ${start}-${end}/${totalLength}`,
      isRange: true,
    };
  }

  // Pattern 2: Bounded `bytes=0-999` or Open-ended `bytes=1000-`
  const boundedMatch = /^(\d+)\s*-\s*(\d*)$/.exec(firstSpec);
  if (!boundedMatch) {
    // Syntax error in range specification: ignore per RFC 7233
    return {
      status: 200,
      isRange: false,
    };
  }

  const start = parseInt(boundedMatch[1], 10);
  const endStr = boundedMatch[2];

  if (isNaN(start) || start < 0) {
    return {
      status: 200,
      isRange: false,
    };
  }

  // If start is at or beyond total length, the range is unsatisfiable
  if (start >= totalLength) {
    return {
      status: 416,
      contentRange: `bytes */${totalLength}`,
      isRange: true,
    };
  }

  let end: number;
  if (!endStr || endStr.trim() === '') {
    // Open-ended: bytes=start-
    end = totalLength - 1;
  } else {
    end = parseInt(endStr, 10);
    if (isNaN(end)) {
      return {
        status: 200,
        isRange: false,
      };
    }

    // If end is smaller than start, range is unsatisfiable
    if (end < start) {
      return {
        status: 416,
        contentRange: `bytes */${totalLength}`,
        isRange: true,
      };
    }

    // Clamp end to the last byte of the file
    end = Math.min(end, totalLength - 1);
  }

  return {
    status: 206,
    start,
    end,
    chunkLength: end - start + 1,
    contentRange: `bytes ${start}-${end}/${totalLength}`,
    isRange: true,
  };
}
