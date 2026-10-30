export type Role = 'user' | 'moderator' | 'admin';
export type DocumentStatus = 'draft' | 'processing' | 'pending_review' | 'published' | 'rejected' | 'failed' | 'archived';
export type StorageType = 'telegram' | 'r2' | 'local' | 'supabase';
export type ViewMode = 'single' | 'double' | 'continuous';
export type OCRStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type AnnotationType = 'highlight' | 'underline' | 'note' | 'box' | 'freehand';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ReportReason = 'copyright' | 'inappropriate' | 'corrupted' | 'spam' | 'other';
export type ReportStatus = 'pending' | 'investigating' | 'resolved' | 'dismissed';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number;
  file_hash: string | null;
  mime_type: string;
  page_count: number;
  cover_image_url: string | null;
  storage_type: StorageType;
  storage_file_id: string | null;
  storage_file_path: string | null;
  is_public: boolean;
  status: DocumentStatus;
  categories: string[];
  tags: string[];
  likes_count: number;
  views_count: number;
  is_trash: boolean;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
  contributor_name?: string;
  is_liked?: boolean;
  is_favorite?: boolean;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
  document_count?: number;
}

export interface Notebook {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  color: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  note_count?: number;
}

export interface Note {
  id: string;
  user_id: string;
  notebook_id: string | null;
  document_id: string | null;
  page_number: number | null;
  title: string;
  content_json: any;
  content_html: string;
  tags: string[];
  is_favorite: boolean;
  selected_text: string | null;
  highlight_coords: any | null;
  created_at: string;
  updated_at: string;
  document_title?: string;
  notebook_title?: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  document_id: string;
  page_number: number;
  title: string | null;
  color: string;
  created_at: string;
  document_title?: string;
}

export interface Annotation {
  id: string;
  user_id: string;
  document_id: string;
  page_number: number;
  type: AnnotationType;
  color: string;
  rects: { x: number; y: number; width: number; height: number }[];
  content: string | null;
  created_at: string;
  updated_at: string;
}

export interface CropSettings {
  enabled: boolean;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
  isAutoDetected?: boolean;
}

export interface ReadingProgress {
  id: string;
  user_id: string;
  document_id: string;
  current_page: number;
  total_pages: number;
  percentage: number;
  zoom_level: number;
  view_mode: ViewMode;
  crop_settings: CropSettings | null;
  active_seconds: number;
  last_read_at: string;
}

export interface OCRPage {
  id: string;
  document_id: string;
  page_number: number;
  status: OCRStatus;
  extracted_text: string;
  confidence: number;
  language: string;
  words_data: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContributionSubmission {
  id: string;
  user_id: string;
  document_id: string | null;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number;
  categories: string[];
  tags: string[];
  rights_declared: boolean;
  status: DocumentStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackupJob {
  id: string;
  user_id: string;
  destination: 'telegram' | 'r2' | 'local';
  status: JobStatus;
  total_items: number;
  successful_items: number;
  failed_items: number;
  error_log: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackupItem {
  id: string;
  job_id: string;
  document_id: string;
  document_title?: string;
  telegram_message_id?: number | null;
  telegram_file_id?: string | null;
  status: JobStatus;
  error_message?: string | null;
  created_at: string;
}

export interface ContentReport {
  id: string;
  reporter_id: string | null;
  document_id: string;
  document_title?: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolution_notes: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  document_count?: number;
}

export type TelegramUploadStatus =
  | 'received'
  | 'validating'
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'unpublished'
  | 'processing_failed';

export interface TelegramUpload {
  id: string;
  telegram_file_id: string;
  telegram_file_unique_id: string;
  telegram_chat_id: number;
  telegram_message_id: number;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_hash: string | null;
  title: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  tags: string[];
  author: string | null;
  language: string;
  publication_year: number | null;
  thumbnail_url: string | null;
  status: TelegramUploadStatus;
  rejection_reason: string | null;
  uploaded_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  document_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AdminSession {
  id: string;
  token_hash: string;
  username: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface AdminActivityLog {
  id: string;
  admin_username: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, any>;
  created_at: string;
}
