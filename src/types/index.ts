export type AttachmentType =
  | 'image'
  | 'video'
  | 'file'
  | 'link'
  | 'voice'
  | 'checklist'
  | 'code'
  | 'blockquote';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  isSection?: boolean; // renders as numbered section header
}

export interface Attachment {
  id: string;
  type: AttachmentType;
  content: string;
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
  blockquoteColor?: string; // 'purple' | 'orange' | 'gray'
}

export interface ClipoNote {
  id: string;
  title: string;
  content: string; // stored as HTML for rich text
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  userId: string;
  shared?: boolean;
  password?: string;
  label?: string;
  isPinned?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  connectedDevices: string[];
}
