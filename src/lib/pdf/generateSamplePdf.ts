import fs from 'fs';
import path from 'path';

/**
 * Builds a valid, standard-compliant multi-page PDF without external binary tools.
 * Perfect for local testing, demo libraries, and PDF.js rendering.
 */
export function buildSamplePdf(): Buffer {
  const pages = [
    {
      title: 'Modern Distributed Systems Architecture',
      subtitle: 'Chapter 1: Principles of Fault-Tolerant State Machines',
      body: [
        'Distributed systems are composed of autonomous computing entities that communicate',
        'over asynchronous networks. Network partitions, packet loss, and unpredictable delays',
        'are normal operating conditions rather than exceptional failures.',
        '',
        'Key Architectural Pillars:',
        '1. Consistency, Availability, Partition Tolerance (CAP Theorem)',
        '2. State Machine Replication via Consensus (Raft / Multi-Paxos)',
        '3. At-least-once message delivery with idempotent execution receivers',
        '4. Distributed tracing and telemetry correlation IDs',
      ],
    },
    {
      title: 'Raft Consensus Protocol & Heartbeats',
      subtitle: 'Chapter 2: Leader Election and Invariants',
      body: [
        'A Raft cluster consists of several servers; typically 5, allowing the system to tolerate',
        '2 failures. At any given time, each server is in one of three states:',
        '- Leader: Handles all client requests, replicates log entries.',
        '- Follower: Passive, responds to requests from leaders and candidates.',
        '- Candidate: Used to elect a new leader during election timeouts.',
        '',
        'AppendEntries RPC Invariants:',
        '- If two entries in different logs have the same index and term, they store the same command.',
        '- If two entries in different logs have the same index and term, then their logs are identical',
        '  in all preceding entries.',
      ],
    },
    {
      title: 'Code Focus Mode: Distributed Lock Implementation',
      subtitle: 'Chapter 3: Lease Management & Fencing Tokens',
      body: [
        '// Distributed Lock with TTL and Fencing Token',
        'export class DistributedLock {',
        '  private readonly key: string;',
        '  private readonly leaseMs: number;',
        '  private fencingToken: number = 0;',
        '',
        '  async acquire(): Promise<{ token: number; release: () => Promise<void> }> {',
        '    const token = await redis.eval(ACQUIRE_LUA_SCRIPT, [this.key], [this.leaseMs]);',
        '    if (!token) throw new Error("Could not acquire distributed lock");',
        '    this.fencingToken = Number(token);',
        '    return { token: this.fencingToken, release: () => this.release() };',
        '  }',
        '}',
      ],
    },
    {
      title: 'Saga Pattern vs Two-Phase Commit',
      subtitle: 'Chapter 4: Orchestration and Compensating Transactions',
      body: [
        'In microservice architectures where data is partitioned across multiple distinct databases,',
        'atomic 2PC protocols impose high latency and single points of failure (the coordinator).',
        '',
        'The Saga pattern breaks a distributed transaction into a sequence of local transactions.',
        'Each local transaction updates the database and publishes a message or event to trigger',
        'the next local transaction in the saga.',
        '',
        'If a local transaction fails, the saga executes compensating transactions that undo the changes',
        'made by preceding transactions.',
      ],
    },
    {
      title: 'High-Throughput Storage & Backup Architecture',
      subtitle: 'Chapter 5: Telegram Cloud Persistence & Deduplication',
      body: [
        'Integrating Telegram Bot API as an encrypted cloud storage tier enables:',
        '- Zero-cost decentralized document archiving for verified open-access libraries.',
        '- High network throughput and global edge CDN availability.',
        '- Automatic SHA-256 integrity verification and content-addressable storage keys.',
        '',
        'Upload constraints & architecture:',
        '- Telegram Bot API standard file upload threshold: 50 MB.',
        '- Self-hosted local Telegram Bot API server threshold: 2,000 MB (2 GB).',
        '- Application level validation verifies magic bytes %PDF- and checks EOF integrity.',
      ],
    },
  ];

  const objects: string[] = [];

  // Obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

  // Obj 2: Pages list (will update Kids count)
  const pageObjectIds: number[] = [];
  let nextObjId = 3;

  // Obj 3: Font
  const fontObjId = nextObjId++;
  objects.push(`${fontObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  // Build page and content stream objects
  pages.forEach((p) => {
    const pageObjId = nextObjId++;
    const contentObjId = nextObjId++;
    pageObjectIds.push(pageObjId);

    // Build PDF content stream
    let streamText = 'BT\n';
    streamText += `/F1 20 Tf\n`;
    streamText += `50 720 Td\n`;
    streamText += `(${escapePdfString(p.title)}) Tj\n`;
    streamText += `/F1 13 Tf\n`;
    streamText += `0 -25 Td\n`;
    streamText += `(${escapePdfString(p.subtitle)}) Tj\n`;
    streamText += `/F1 11 Tf\n`;
    streamText += `0 -35 Td\n`;

    p.body.forEach((line) => {
      streamText += `(${escapePdfString(line)}) Tj\n`;
      streamText += `0 -18 Td\n`;
    });

    streamText += 'ET';
    const streamLen = Buffer.byteLength(streamText, 'latin1');

    objects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj`
    );

    objects.push(
      `${contentObjId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream\nendobj`
    );
  });

  // Now create Obj 2 (Pages root)
  const kidsStr = pageObjectIds.map((id) => `${id} 0 R`).join(' ');
  objects.splice(
    1,
    0,
    `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pages.length} >>\nendobj`
  );

  // Build final PDF buffer
  let pdfContent = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];

  objects.forEach((obj) => {
    offsets.push(Buffer.byteLength(pdfContent, 'latin1'));
    pdfContent += obj + '\n';
  });

  const xrefOffset = Buffer.byteLength(pdfContent, 'latin1');
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    xref += off.toString().padStart(10, '0') + ' 00000 n \n';
  });

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdfContent + xref + trailer, 'latin1');
}

function escapePdfString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// Generate the sample file if run directly or during build
export function ensureSamplePdfFile(destinationDir: string) {
  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }
  const destPath = path.join(destinationDir, 'sample-study-guide.pdf');
  const buffer = buildSamplePdf();
  fs.writeFileSync(destPath, buffer);
  return destPath;
}
