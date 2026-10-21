import { z } from 'zod';

export const documentUploadSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200, 'Title is too long'),
  description: z.string().max(2000, 'Description is too long').optional().default(''),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  is_public: z.boolean().default(false),
  rights_declared: z.boolean().refine(val => val === true, {
    message: 'You must confirm that you have the rights to upload or distribute this PDF',
  }),
});

export const noteSchema = z.object({
  id: z.string().uuid().optional(),
  notebook_id: z.string().uuid().nullable().optional(),
  document_id: z.string().uuid().nullable().optional(),
  page_number: z.number().int().positive().nullable().optional(),
  title: z.string().min(1, 'Title cannot be empty').max(200).default('Untitled Note'),
  content_json: z.any().optional().default({ type: 'doc', content: [] }),
  content_html: z.string().default(''),
  tags: z.array(z.string()).default([]),
  is_favorite: z.boolean().default(false),
  selected_text: z.string().nullable().optional(),
  highlight_coords: z.any().nullable().optional(),
});

export const notebookSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional().default(''),
  color: z.string().default('#8b5cf6'),
});

export const bookmarkSchema = z.object({
  document_id: z.string().uuid(),
  page_number: z.number().int().positive(),
  title: z.string().max(100).optional().default(''),
  color: z.string().default('#3b82f6'),
});

export const annotationSchema = z.object({
  id: z.string().uuid().optional(),
  document_id: z.string().uuid(),
  page_number: z.number().int().positive(),
  type: z.enum(['highlight', 'underline', 'note', 'box', 'freehand']),
  color: z.string().default('#fef08a'),
  rects: z.array(z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })),
  content: z.string().optional().nullable(),
});

export const readingProgressSchema = z.object({
  document_id: z.string().uuid(),
  current_page: z.number().int().positive(),
  total_pages: z.number().int().positive(),
  percentage: z.number().min(0).max(100),
  zoom_level: z.number().min(0.2).max(5.0).default(1.0),
  view_mode: z.enum(['single', 'double', 'continuous']).default('single'),
  crop_settings: z.object({
    enabled: z.boolean(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    isAutoDetected: z.boolean().optional(),
  }).nullable().optional(),
  active_seconds: z.number().int().min(0).default(0),
});

export const ocrRequestSchema = z.object({
  document_id: z.string().uuid(),
  page_number: z.number().int().positive(),
  language: z.string().default('eng'),
});

export const submissionReviewSchema = z.object({
  submission_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  rejection_reason: z.string().optional(),
});

export const contentReportSchema = z.object({
  document_id: z.string().uuid(),
  reason: z.enum(['copyright', 'inappropriate', 'corrupted', 'spam', 'other']),
  details: z.string().max(1000).optional(),
});

export const telegramBackupSchema = z.object({
  document_ids: z.array(z.string().uuid()).min(1, 'Select at least one document to backup'),
  destination: z.enum(['telegram', 'r2', 'local']).default('telegram'),
});
