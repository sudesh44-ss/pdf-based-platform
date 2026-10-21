import { describe, it, expect } from 'vitest';
import {
  documentUploadSchema,
  noteSchema,
  bookmarkSchema,
  telegramBackupSchema,
  submissionReviewSchema,
} from './schemas';

describe('Zod Validation Schemas', () => {
  it('validates document uploads requiring rights declaration', () => {
    const valid = {
      title: 'Distributed Systems & Paxos',
      description: 'Study notes on distributed consensus',
      categories: ['Computer Science'],
      tags: ['Paxos', 'Consensus'],
      is_public: true,
      rights_declared: true,
    };
    expect(documentUploadSchema.safeParse(valid).success).toBe(true);

    const invalidNoRights = {
      ...valid,
      rights_declared: false,
    };
    expect(documentUploadSchema.safeParse(invalidNoRights).success).toBe(false);

    const invalidShortTitle = {
      ...valid,
      title: 'A',
    };
    expect(documentUploadSchema.safeParse(invalidShortTitle).success).toBe(false);
  });

  it('validates study note schema', () => {
    const validNote = {
      title: 'Raft Log Invariants',
      content_html: '<h2>Leader election</h2><p>Heartbeats every 150ms</p>',
      tags: ['Raft', 'Consensus'],
      page_number: 3,
    };
    expect(noteSchema.safeParse(validNote).success).toBe(true);
  });

  it('validates bookmark schema', () => {
    const validBookmark = {
      document_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      page_number: 4,
      title: 'Important Graph Proof',
    };
    expect(bookmarkSchema.safeParse(validBookmark).success).toBe(true);
  });

  it('validates telegram backup request requiring at least 1 document', () => {
    const valid = {
      document_ids: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
      destination: 'telegram',
    };
    expect(telegramBackupSchema.safeParse(valid).success).toBe(true);

    const empty = {
      document_ids: [],
      destination: 'telegram',
    };
    expect(telegramBackupSchema.safeParse(empty).success).toBe(false);
  });

  it('validates moderation submission review schema', () => {
    const approve = {
      submission_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      action: 'approve',
    };
    expect(submissionReviewSchema.safeParse(approve).success).toBe(true);

    const reject = {
      submission_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      action: 'reject',
      rejection_reason: 'Does not meet technical guidelines',
    };
    expect(submissionReviewSchema.safeParse(reject).success).toBe(true);
  });
});
