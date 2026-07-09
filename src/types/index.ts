export type AttachmentType =
  | 'image'
  | 'video'
  | 'file'
  | 'voice'
  | 'checklist'
  | 'code'
  | 'table'
  | 'bullet'
  | 'numbered'
  | 'divider'
  | 'text'
  | 'link';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  isSection?: boolean;
}

export interface TableData {
  rows: number;
  cols: number;
  cells: string[][];
  hasHeader?: boolean;
}

export interface Attachment {
  id: string;
  type: AttachmentType;
  content: string;
  isDrawing?: boolean;
  storagePath?: string;
  fileSizeBytes?: number;
  checklistItems?: ChecklistItem[];
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  duration?: number;
  linkTitle?: string;
  linkDescription?: string;
  linkImage?: string;
  waveform?: number[];
  codeLanguage?: string;
  tableData?: TableData;
  listItems?: string[];
}

export type CollaboratorRole = 'viewer' | 'editor';

export interface Collaborator {
  uid: string;
  email: string;
  name?: string;
  photoURL?: string;
  role: CollaboratorRole;
  addedAt: string;
}

export interface ClipoNote {
  id: string;
  title: string;
  content: string;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  /** @deprecated use ownerId — kept for Firestore backwards compat */
  userId?: string;
  label?: string;
  isPinned?: boolean;
  collaborators?: Collaborator[];
  collaboratorUids?: string[];
  pinHash?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}
