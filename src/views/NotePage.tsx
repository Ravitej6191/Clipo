import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { useNotes } from '../contexts/NoteContext';
import type { Attachment } from '../types';
import { VoiceRecorder } from '../components/VoiceRecorder';
import DrawingCanvas from './DrawingCanvas';
import { useUI } from '../contexts/UIContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Check, MoreHorizontal, Play, Pause, Download,
  ExternalLink, Share2, Copy, Trash2, Eye,
  Image as ImageIcon, Mic, FileText, Link as LinkIcon, Video as VideoIcon,
  Code, PenLine, ListChecks, Type,
  Bold, Italic, Underline, Strikethrough, List, ListOrdered as ListNumbered,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, Indent, Outdent,
  ChevronUp, ChevronDown, X, Hash, Loader2, Plus,
  Table2, Minus, Circle, HardDrive, GripVertical,
  Lock, Unlock, KeyRound,
} from 'lucide-react';
import { uploadFile as uploadToStorage, deleteFile as deleteFromStorage } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import ShareSheet from '../components/ShareSheet';
import DOMPurify from 'dompurify';
import imageCompression from 'browser-image-compression';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import 'highlight.js/styles/tokyo-night-dark.css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);

// ─── File validation ──────────────────────────────────────────────────────────
const ALLOWED_TYPES: Record<'image' | 'video' | 'file', string[]> = {
  image: ['image/jpeg','image/jpg','image/png','image/gif','image/webp','image/svg+xml'],
  video: ['video/mp4','video/webm','video/ogg','video/quicktime'],
  file: [
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain','application/zip','text/csv',
  ],
};

// Allowed file extensions per type (double-check alongside MIME)
const ALLOWED_EXTS: Record<'image' | 'video' | 'file', string[]> = {
  image: ['jpg','jpeg','png','gif','webp','svg'],
  video: ['mp4','webm','ogg','mov'],
  file:  ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','zip','csv'],
};

const MAX_MB: Record<'image' | 'video' | 'file', number> = { image: 10, video: 100, file: 25 };
const MAX_NOTE_MB  = 150;   // total attachments per note
const MAX_VOICE_MB = 20;    // per voice recording

const EXT_LABELS: Record<'image' | 'video' | 'file', string> = {
  image: 'JPG, PNG, GIF, WebP, SVG',
  video: 'MP4, WebM, OGG, MOV',
  file: 'PDF, DOC, XLS, PPT, TXT, ZIP, CSV',
};

// Magic-byte signatures to verify actual file content
const MAGIC: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg',   bytes: [0xFF,0xD8,0xFF] },
  { mime: 'image/png',    bytes: [0x89,0x50,0x4E,0x47] },
  { mime: 'image/gif',    bytes: [0x47,0x49,0x46] },
  { mime: 'image/webp',   bytes: [0x52,0x49,0x46,0x46], offset: 0 },
  { mime: 'application/pdf', bytes: [0x25,0x50,0x44,0x46] },
  { mime: 'application/zip', bytes: [0x50,0x4B,0x03,0x04] },
  { mime: 'video/mp4',    bytes: [0x66,0x74,0x79,0x70], offset: 4 },
];

async function checkMagicBytes(file: File): Promise<boolean> {
  // SVG and text files have no magic bytes — skip check
  if (file.type === 'image/svg+xml' || file.type === 'text/plain' || file.type === 'text/csv') return true;
  const buf = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buf);
  for (const sig of MAGIC) {
    if (!file.type.startsWith(sig.mime.split('/')[0]) && file.type !== sig.mime) continue;
    const off = sig.offset ?? 0;
    if (sig.bytes.every((b, i) => bytes[off + i] === b)) return true;
  }
  // If no signature matched for a known-signatured type, fail
  const siggedTypes = MAGIC.map(m => m.mime);
  if (siggedTypes.includes(file.type)) return false;
  return true; // unknown type with no signature rule — allow (MIME + ext already checked)
}

type FileType = 'image' | 'video' | 'file';

async function validateFile(file: File, type: FileType, existingBytes: number): Promise<{ ok: boolean; reason?: string }> {
  // 1. Empty file
  if (file.size === 0) return { ok: false, reason: 'File is empty.' };

  // 2. Extension check
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTS[type].includes(ext))
    return { ok: false, reason: `Invalid file type. Allowed: ${EXT_LABELS[type]}.` };

  // 3. MIME type check
  if (file.type && !ALLOWED_TYPES[type].includes(file.type))
    return { ok: false, reason: `Unsupported format (${file.type}). Allowed: ${EXT_LABELS[type]}.` };

  // 4. Per-file size limit
  const fileMB = file.size / 1024 / 1024;
  if (fileMB > MAX_MB[type])
    return { ok: false, reason: `File too large (${fileMB.toFixed(1)} MB). Max ${MAX_MB[type]} MB for ${type}s.` };

  // 5. Per-note total quota
  const totalMB = (existingBytes + file.size) / 1024 / 1024;
  if (totalMB > MAX_NOTE_MB)
    return { ok: false, reason: `Note would exceed ${MAX_NOTE_MB} MB total. Remove some files first.` };

  // 6. Magic bytes (content vs extension spoofing)
  const magicOk = await checkMagicBytes(file);
  if (!magicOk) return { ok: false, reason: 'File content does not match its extension. Upload rejected.' };

  return { ok: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1024 ** 2 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 ** 2).toFixed(1)} MB`;
const fmtDuration = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
};

// ─── PIN hash ────────────────────────────────────────────────────────────────
async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Upload helper (Firebase Storage) ────────────────────────────────────────
async function uploadFile(
  blob: Blob,
  userId: string,
  fileName: string,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; storagePath: string; bytes: number }> {
  return uploadToStorage(blob, userId, fileName, onProgress);
}

// ─── Open Graph link preview ──────────────────────────────────────────────────
async function fetchLinkMeta(url: string): Promise<{ title: string; description?: string; image?: string }> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false`, { signal: controller.signal });
    const json = await res.json();
    if (json.status === 'success') {
      return {
        title: json.data?.title || url,
        description: json.data?.description || '',
        image: json.data?.image?.url || '',
      };
    }
  } catch { /* timeout or network — fall through */ }
  finally { clearTimeout(tid); }
  return { title: url };
}

// ─── Bottom sheet wrapper ─────────────────────────────────────────────────────
const Sheet: React.FC<{
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}> = ({ open, onClose, children, title }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
        >
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>
          {title && (
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <h2 className="text-sm font-bold text-[#111827]">{title}</h2>
              <button onClick={onClose} aria-label="Close"
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}
          <div className="overflow-y-auto">{children}</div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ─── Waveform bars ────────────────────────────────────────────────────────────
const WaveformBars: React.FC<{ waveform: number[]; playing?: boolean }> = ({ waveform, playing }) => (
  <div className="flex items-end gap-[2px] flex-1 h-8" aria-hidden="true">
    {waveform.map((h, i) => (
      <div key={i}
        className={`flex-1 bg-white/80 rounded-full min-h-[15%] ${playing ? 'animate-equalizer' : ''}`}
        style={{ height: `${Math.max(15, h)}%`, animationDelay: playing ? `${(i % 5) * 0.12}s` : undefined }}
      />
    ))}
  </div>
);

// ─── Upload progress ring ─────────────────────────────────────────────────────
const UploadProgress: React.FC<{ pct: number }> = ({ pct }) => (
  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
    <div className="flex flex-col items-center gap-1.5">
      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="3" />
        <circle cx="20" cy="20" r="16" fill="none" stroke="white" strokeWidth="3"
          strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset="0"
          pathLength="100" strokeLinecap="round" />
      </svg>
      <span className="text-white text-[10px] font-bold">{Math.round(pct)}%</span>
    </div>
  </div>
);

// ─── Code block with syntax highlighting ─────────────────────────────────────
const CODE_LANGS = ['javascript','typescript','python','css','html','json','bash','other'];

const CodeBlock: React.FC<{
  att: Attachment;
  onChange: (content: string) => void;
  onLanguageChange: (lang: string) => void;
}> = ({ att, onChange, onLanguageChange }) => {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlighted = att.codeLanguage && att.codeLanguage !== 'other' && att.content
    ? hljs.highlight(att.content, { language: att.codeLanguage, ignoreIllegals: true }).value
    : hljs.highlightAuto(att.content || '').value;

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  return (
    <div className="bg-[#1a1b2e] rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-2 bg-white/5 flex items-center justify-between gap-2">
        {/* Inline language dropdown */}
        <select
          value={att.codeLanguage || 'javascript'}
          onChange={e => onLanguageChange(e.target.value)}
          className="bg-transparent text-[11px] font-mono text-white/50 outline-none cursor-pointer hover:text-white/80 transition-colors pr-4"
        >
          {CODE_LANGS.map(l => <option key={l} value={l} style={{ background: '#1a1b2e' }}>{l}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(e => !e)} aria-label={editing ? 'Preview' : 'Edit'}
            className="text-xs text-white/40 hover:text-white/80 flex items-center gap-1 transition-colors">
            {editing ? <Eye className="w-3 h-3" /> : <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
            {editing ? 'Preview' : 'Edit'}
          </button>
          <div className="w-px h-3 bg-white/10" />
          <button
            onClick={() => {
              navigator.clipboard.writeText(att.content).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }).catch(() => {});
            }}
            aria-label="Copy code"
            className="text-xs text-white/40 hover:text-white/80 flex items-center gap-1 transition-colors"
          >
            {copied ? <><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          ref={textareaRef}
          value={att.content}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          spellCheck={false}
          aria-label="Code editor"
          rows={Math.max(4, (att.content.match(/\n/g)?.length ?? 0) + 1)}
          className="w-full bg-transparent text-xs font-mono text-[#A9B1D6] px-4 py-3 resize-none outline-none leading-relaxed max-h-80 overflow-y-auto"
          style={{ caretColor: '#A9B1D6' }}
        />
      ) : (
        <pre
          onClick={() => setEditing(true)}
          className="text-xs font-mono p-4 overflow-x-auto leading-relaxed max-h-80 cursor-text"
          dangerouslySetInnerHTML={{ __html: highlighted || '// Your code here' }}
        />
      )}
    </div>
  );
};

// ─── Checklist block ──────────────────────────────────────────────────────────
const ChecklistBlock: React.FC<{
  att: Attachment;
  onToggle: (attId: string, itemId: string) => void;
  onAddItem: (attId: string, text: string, isSection?: boolean) => void;
  onDeleteItem: (attId: string, itemId: string) => void;
  onRenameItem: (attId: string, itemId: string, text: string) => void;
}> = ({ att, onToggle, onAddItem, onDeleteItem, onRenameItem }) => {
  const [newText, setNewText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const items = att.checklistItems ?? [];
  let sectionIdx = 0;

  const done = items.filter(i => !i.isSection && i.completed).length;
  const total = items.filter(i => !i.isSection).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
      {total > 0 && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">
            {done}/{total} done
          </span>
          <div className="flex-1 mx-3 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#111827] to-[#7C3AED] rounded-full transition-all duration-300"
              style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {items.map(item => {
        if (item.isSection) {
          sectionIdx++;
          return (
            <div key={item.id} className="flex items-center gap-2 mt-2 first:mt-0 group/sec">
              <span className="text-xs font-bold text-[#9CA3AF] shrink-0">{sectionIdx}.</span>
              <input
                className="flex-1 text-xs font-bold text-[#111827] uppercase tracking-wide bg-transparent outline-none placeholder:text-gray-300"
                value={item.text}
                placeholder="Section heading"
                onChange={e => onRenameItem(att.id, item.id, e.target.value)}
              />
              <button onClick={() => onDeleteItem(att.id, item.id)} aria-label="Remove section"
                className="opacity-0 group-hover/sec:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center text-gray-300 active:text-red-400 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        }
        return (
          <div key={item.id} className="flex items-center gap-3">
            <button onClick={() => onToggle(att.id, item.id)}
              aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
              className="shrink-0">
              {item.completed ? (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              )}
            </button>
            <span className={`text-sm flex-1 ${item.completed ? 'line-through text-gray-400' : 'text-[#374151]'}`}>
              {item.text}
            </span>
            <button onClick={() => onDeleteItem(att.id, item.id)} aria-label="Delete item"
              className="w-6 h-6 flex items-center justify-center text-gray-300 active:text-red-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      {/* Add new item */}
      <div className="flex items-center gap-2 mt-1 pt-2 border-t border-gray-50">
        <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" />
        <input
          ref={inputRef}
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && newText.trim()) {
              onAddItem(att.id, newText.trim());
              setNewText('');
            }
          }}
          placeholder="Add item…"
          className="flex-1 text-sm text-[#374151] placeholder:text-gray-300 outline-none bg-transparent"
        />
        {newText.trim() && (
          <button onClick={() => { onAddItem(att.id, newText.trim()); setNewText(''); inputRef.current?.focus(); }}
            aria-label="Add item"
            className="w-6 h-6 rounded-full bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center">
            <Check className="w-3 h-3 text-white stroke-[3]" />
          </button>
        )}
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN NotePage component
// ═══════════════════════════════════════════════════════════════════════════════
interface NotePageProps {
  noteId: string;
  onBack: () => void;
  onNoteDeleted?: () => void; // bypasses guest-leave warning (note already gone)
}

type ToolTab = 'media' | 'list' | 'format' | 'code';

const NotePage: React.FC<NotePageProps> = ({ noteId, onBack, onNoteDeleted }) => {
  const { notes, updateNote, deleteNote, subscribeSharedNote } = useNotes();
  const { showToast, showConfirm } = useUI();
  const { user } = useAuth();

  // ── Live note state (via Firestore onSnapshot or localStorage) ────────────
  const [note, setNote] = useState<Parameters<typeof updateNote>[1] & { id: string; updatedAt: string; password?: string } | null>(null);

  const titleRef    = useRef<HTMLDivElement>(null);
  const bodyRef     = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const domSeeded   = useRef(false);

  // ── Local state ──────────────────────────────────────────────────────────
  const [noteNotFound, setNoteNotFound] = useState(false);
  const [attachments, setAttachments]   = useState<Attachment[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const [playingId, setPlayingId]       = useState<string | null>(null);
  const playAudioRef = useRef<HTMLAudioElement | null>(null);

  // Upload progress map: attId → percentage
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Drawing edit
  const [editingDrawingId, setEditingDrawingId] = useState<string | null>(null);

  // PIN lock
  const [pinLocked, setPinLocked]         = useState(false);
  const [pinInput, setPinInput]           = useState('');
  const [pinError, setPinError]           = useState(false);
  const [showPinSetup, setShowPinSetup]   = useState(false);
  const [pinSetupStep, setPinSetupStep]   = useState<'enter' | 'confirm'>('enter');
  const [pinSetupFirst, setPinSetupFirst] = useState('');
  const [pinSetupVal, setPinSetupVal]     = useState('');

  // Sheet visibility
  const [showContext, setShowContext]     = useState(false);
  const [showShare, setShowShare]         = useState(false);
  const [showVoice, setShowVoice]         = useState(false);
  const [showDrawing, setShowDrawing]     = useState(false);
  const [showLinkSheet, setShowLinkSheet] = useState(false);
  const [linkInput, setLinkInput]         = useState('');
  const [linkLoading, setLinkLoading]     = useState(false);
  const [showExitWarn, setShowExitWarn]     = useState(false);
  // Bottom toolbar
  const [activeTab, setActiveTab] = useState<ToolTab | null>(null);

  // Save status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');


  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset initialization flags whenever noteId changes (different note opened)
  useEffect(() => { initialized.current = false; domSeeded.current = false; }, [noteId]);

  // ── Effect 1: seed React state from local notes (fires when notes updates) ──
  // Sets initialized = true immediately so the Firestore subscription can't
  // overwrite with a stale cached snapshot. DOM refs may still be null here
  // (editor only mounts after note state becomes non-null) — Effect 2 handles that.
  useEffect(() => {
    const local = notes.find(n => n.id === noteId);
    if (local && !initialized.current) {
      setNote(local as any);
      setAttachments(local.attachments ?? []);
      initialized.current = true;
    }
  }, [noteId, notes]);

  // ── Effect 2: seed DOM refs once editor mounts ────────────────────────────
  // The editor only renders after `note` becomes non-null (Effect 1 above sets
  // it). This effect fires after that render, when titleRef/bodyRef are live.
  useEffect(() => {
    if (domSeeded.current || !note) return;
    if (!titleRef.current || !bodyRef.current) return;
    titleRef.current.textContent = (note as any).title || '';
    bodyRef.current.innerHTML   = DOMPurify.sanitize((note as any).content || '');
    domSeeded.current = true;
  }, [note]);

  // ── Subscribe to real-time note updates ──────────────────────────────────
  useEffect(() => {
    setNoteNotFound(false);

    // Timeout: if note hasn't loaded in 10s, assume not found
    const notFoundTimer = setTimeout(() => {
      if (!initialized.current) setNoteNotFound(true);
    }, 10000);

    const unsub = subscribeSharedNote(
      noteId,
      (n) => {
        if (!n) {
          if (!initialized.current) {
            setNoteNotFound(true);
          }
          clearTimeout(notFoundTimer);
          return;
        }
        clearTimeout(notFoundTimer);
        setNote(n as any);
        if (!initialized.current) {
          setAttachments(n.attachments ?? []);
          initialized.current = true;
        } else {
          // Keep attachments in sync with server (e.g. collaborator adds a file)
          // Only update if we're not mid-upload (no pending upload progress)
          setAttachments(prev => {
            const hasPending = prev.some(a => !a.content);
            return hasPending ? prev : (n.attachments ?? []);
          });
        }
      },
      () => {
        clearTimeout(notFoundTimer);
        if (!initialized.current) setNoteNotFound(true);
      },
    );

    return () => { unsub(); clearTimeout(notFoundTimer); };
  }, [noteId, subscribeSharedNote]);

  // Lock note on open if it has a PIN
  useEffect(() => {
    if ((note as any)?.pinHash) setPinLocked(true);
  }, [noteId]); // only on noteId change, not every note update

  // Ref so auto-save always reads the latest attachments without stale closure
  const attachmentsRef = useRef<Attachment[]>([]);
  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);

  // ── Auto-save ────────────────────────────────────────────────────────────
  const scheduleAutoSave = useCallback((newAtts?: Attachment[]) => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const title   = titleRef.current?.textContent?.trim() || '';
      const content = bodyRef.current?.innerHTML || '';
      try {
        await updateNote(noteId, {
          title, content,
          attachments: newAtts ?? attachmentsRef.current,
          updatedAt: new Date().toISOString(),
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 1000);
  }, [noteId, updateNote]);

  // Clear pending auto-save timer on unmount to avoid state updates after navigation
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  // ── Save + back ──────────────────────────────────────────────────────────
  const doSaveAndBack = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const title   = titleRef.current?.textContent?.trim() || '';
    const content = bodyRef.current?.innerHTML || '';
    try {
      await updateNote(noteId, { title, content, attachments, updatedAt: new Date().toISOString() });
    } catch { /* ignore — note stays in Firestore from last successful auto-save */ }
    setSaveStatus('saved');
    onBack();
  };

  const handleSave = () => {
    if (saveStatus === 'saving') { setShowExitWarn(true); return; }
    doSaveAndBack();
  };


  // ── Attachment helpers ───────────────────────────────────────────────────
  const addAttachment = (att: Attachment) => {
    const next = [...attachments, att];
    setAttachments(next);
    scheduleAutoSave(next);
    setActiveTab(null);
    setShowVoice(false);
  };

  const removeAttachment = (id: string) => {
    showConfirm({
      title: 'Remove this item?', message: '',
      onConfirm: () => {
        const att = attachments.find(a => a.id === id);
        const next = attachments.filter(a => a.id !== id);
        setAttachments(next);
        scheduleAutoSave(next);
        // Best-effort Firebase Storage delete
        if (att?.storagePath) deleteFromStorage(att.storagePath);
      },
    });
  };

  const moveAttachment = (id: string, dir: 'up' | 'down') => {
    setAttachments(prev => {
      const idx  = prev.findIndex(a => a.id === id);
      const next = dir === 'up' ? idx - 1 : idx + 1;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      scheduleAutoSave(arr);
      return arr;
    });
  };

  const handleDragStart = (idx: number) => { dragIndexRef.current = idx; };
  const handleDragOver  = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === idx) return;
    setAttachments(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(idx, 0, item);
      dragIndexRef.current = idx;
      scheduleAutoSave(arr);
      return arr;
    });
  };
  const handleDragEnd = () => { dragIndexRef.current = null; };

  const toggleCheckItem = (attId: string, itemId: string) => {
    setAttachments(prev => {
      const next = prev.map(a => a.id !== attId ? a : {
        ...a,
        checklistItems: a.checklistItems?.map(i =>
          i.id === itemId ? { ...i, completed: !i.completed } : i),
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  const addCheckItem = (attId: string, text: string, isSection = false) => {
    setAttachments(prev => {
      const next = prev.map(a => a.id !== attId ? a : {
        ...a,
        checklistItems: [...(a.checklistItems ?? []),
          { id: uid(), text, completed: false, isSection }],
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  const deleteCheckItem = (attId: string, itemId: string) => {
    setAttachments(prev => {
      const next = prev.map(a => a.id !== attId ? a : {
        ...a,
        checklistItems: a.checklistItems?.filter(i => i.id !== itemId),
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  const renameCheckItem = (attId: string, itemId: string, text: string) => {
    setAttachments(prev => {
      const next = prev.map(a => a.id !== attId ? a : {
        ...a,
        checklistItems: a.checklistItems?.map(i => i.id === itemId ? { ...i, text } : i),
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  // ── List block helpers (bullet / numbered) ──────────────────────────────
  const addListItem = (attId: string) => {
    setAttachments(prev => {
      const next = prev.map(a => a.id !== attId ? a : {
        ...a, listItems: [...(a.listItems ?? []), ''],
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  const updateListItem = (attId: string, idx: number, value: string) => {
    setAttachments(prev => {
      const next = prev.map(a => a.id !== attId ? a : {
        ...a, listItems: a.listItems?.map((it, i) => i === idx ? value : it),
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  const removeListItem = (attId: string, idx: number) => {
    setAttachments(prev => {
      const next = prev.map(a => a.id !== attId ? a : {
        ...a, listItems: a.listItems?.filter((_, i) => i !== idx),
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  // ── Table helpers ────────────────────────────────────────────────────────
  const updateTableCell = (attId: string, row: number, col: number, value: string) => {
    setAttachments(prev => {
      const next = prev.map(a => {
        if (a.id !== attId || !a.tableData) return a;
        const cells = a.tableData.cells.map((r, ri) =>
          r.map((c, ci) => (ri === row && ci === col) ? value : c));
        return { ...a, tableData: { ...a.tableData, cells } };
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  const addTableRow = (attId: string) => {
    setAttachments(prev => {
      const next = prev.map(a => {
        if (a.id !== attId || !a.tableData) return a;
        const emptyRow = Array(a.tableData.cols).fill('');
        return { ...a, tableData: { ...a.tableData, rows: a.tableData.rows + 1, cells: [...a.tableData.cells, emptyRow] } };
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  const addTableCol = (attId: string) => {
    setAttachments(prev => {
      const next = prev.map(a => {
        if (a.id !== attId || !a.tableData) return a;
        const cells = a.tableData.cells.map(r => [...r, '']);
        return { ...a, tableData: { ...a.tableData, cols: a.tableData.cols + 1, cells } };
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  const removeTableRow = (attId: string, rowIdx: number) => {
    setAttachments(prev => {
      const next = prev.map(a => {
        if (a.id !== attId || !a.tableData || a.tableData.rows <= 1) return a;
        const cells = a.tableData.cells.filter((_, i) => i !== rowIdx);
        return { ...a, tableData: { ...a.tableData, rows: a.tableData.rows - 1, cells } };
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  const removeTableCol = (attId: string, colIdx: number) => {
    setAttachments(prev => {
      const next = prev.map(a => {
        if (a.id !== attId || !a.tableData || a.tableData.cols <= 1) return a;
        const cells = a.tableData.cells.map(r => r.filter((_, i) => i !== colIdx));
        return { ...a, tableData: { ...a.tableData, cols: a.tableData.cols - 1, cells } };
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  const toggleTableHeader = (attId: string) => {
    setAttachments(prev => {
      const next = prev.map(a => a.id !== attId || !a.tableData ? a : {
        ...a, tableData: { ...a.tableData, hasHeader: !a.tableData.hasHeader },
      });
      scheduleAutoSave(next);
      return next;
    });
  };

  // ── File upload to Firebase Storage ─────────────────────────────────────
  const triggerFile = (type: 'image' | 'video' | 'file') => {
    const r = type === 'image' ? imageInputRef : type === 'video' ? videoInputRef : fileInputRef;
    if (r.current) { r.current.value = ''; r.current.click(); }
    setActiveTab(null);
  };

  const handleFileSelected = async (type: 'image' | 'video' | 'file', file?: File) => {
    if (!file) return;

    const existingBytes = attachments.reduce((s, a) => s + (a.fileSizeBytes ?? 0), 0);
    const result = await validateFile(file, type, existingBytes);
    if (!result.ok) { showToast(result.reason!, 'error'); return; }

    // Duplicate check — same name + size already attached
    const isDupe = attachments.some(a => a.fileName === file.name && a.fileSizeBytes === file.size);
    if (isDupe) { showToast('This file is already attached.', 'error'); return; }

    const sizeMB = file.size / 1024 / 1024;
    const attId = uid();
    const placeholder: Attachment = {
      id: attId, type: type as any,
      content: '',
      fileName: file.name,
      fileSize: `${sizeMB.toFixed(1)} MB`,
      fileSizeBytes: file.size,
      ...(type === 'file' ? { fileType: file.type } : {}),
    };

    const withPlaceholder = [...attachments, placeholder];
    setAttachments(withPlaceholder);

    try {
      let blob: Blob = file;

      if (type === 'image') {
        blob = await imageCompression(file, {
          maxSizeMB: 2,
          maxWidthOrHeight: 2048,
          useWebWorker: true,
        });
      }

      const { url, storagePath, bytes } = await uploadFile(
        blob, user?.uid ?? 'anon', file.name,
        (pct) => setUploadProgress(prev => ({ ...prev, [attId]: pct })),
      );

      setUploadProgress(prev => { const n = { ...prev }; delete n[attId]; return n; });

      const finalAtts = withPlaceholder.map(a =>
        a.id === attId ? { ...a, content: url, storagePath: storagePath || undefined, fileSizeBytes: bytes || undefined } : a,
      );
      setAttachments(finalAtts);
      scheduleAutoSave(finalAtts);
    } catch {
      showToast('Upload failed. Please try again.', 'error');
      setAttachments(withPlaceholder.filter(a => a.id !== attId));
      setUploadProgress(prev => { const n = { ...prev }; delete n[attId]; return n; });
    }
  };

  // ── Voice upload ─────────────────────────────────────────────────────────
  const handleVoiceSave = async (url: string, dur: number, wf: number[]) => {
    const attId = uid();
    try {
      const blob = await fetch(url).then(r => r.blob());

      // Voice size guard
      const voiceMB = blob.size / 1024 / 1024;
      if (voiceMB > MAX_VOICE_MB) {
        showToast(`Voice recording too large (${voiceMB.toFixed(1)} MB). Max ${MAX_VOICE_MB} MB.`, 'error');
        return;
      }
      const existingBytes = attachments.reduce((s, a) => s + (a.fileSizeBytes ?? 0), 0);
      const totalMB = (existingBytes + blob.size) / 1024 / 1024;
      if (totalMB > MAX_NOTE_MB) {
        showToast(`Note would exceed ${MAX_NOTE_MB} MB total. Remove some files first.`, 'error');
        return;
      }

      const { url: storageUrl, storagePath, bytes } = await uploadFile(
        blob, user?.uid ?? 'anon', 'voice.webm',
        (pct) => setUploadProgress(prev => ({ ...prev, [attId]: pct })),
      );
      setUploadProgress(prev => { const n = { ...prev }; delete n[attId]; return n; });
      addAttachment({ id: attId, type: 'voice', content: storageUrl, duration: dur, waveform: wf, storagePath: storagePath || undefined, fileSizeBytes: bytes || undefined });
    } catch {
      showToast('Voice upload failed.', 'error');
    }
  };

  // ── Audio playback ───────────────────────────────────────────────────────
  const toggleAudio = (att: Attachment) => {
    if (playingId === att.id) {
      playAudioRef.current?.pause(); setPlayingId(null);
    } else {
      playAudioRef.current?.pause();
      const audio = new Audio(att.content);
      audio.onended = () => setPlayingId(null);
      playAudioRef.current = audio;
      audio.play();
      setPlayingId(att.id);
    }
  };

  // ── Rich text formatting ─────────────────────────────────────────────────
  const execFormat = (cmd: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value ?? undefined);
  };

  // ── Link with OG preview ─────────────────────────────────────────────────
  const handleAddLink = async () => {
    if (!linkInput.trim()) return;
    setLinkLoading(true);
    const meta = await fetchLinkMeta(linkInput.trim());
    setLinkLoading(false);
    addAttachment({
      id: uid(), type: 'link',
      content: linkInput.trim(),
      linkTitle: meta.title,
      linkDescription: meta.description,
      linkImage: meta.image,
    });
    setShowLinkSheet(false);
    setLinkInput('');
  };

  // ── Share ────────────────────────────────────────────────────────────────
  const openShare = () => {
    setShowContext(false);
    setShowShare(true);
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = () => {
    setShowContext(false);
    showConfirm({
      title: 'Delete Space', message: 'This cannot be undone.',
      confirmLabel: 'Delete', isDanger: true,
      onConfirm: () => {
        // Delete all Firebase Storage assets (best-effort, non-blocking)
        attachments.forEach(att => { if (att.storagePath) deleteFromStorage(att.storagePath); });
        deleteNote(noteId)
          .then(() => (onNoteDeleted ?? onBack)())
          .catch(() => showToast('Delete failed. Try again.', 'error'));
      },
    });
  };


  // ── PIN unlock ──────────────────────────────────────────────────────────────
  const handlePinDigit = async (d: string) => {
    const next = (pinInput + d).slice(0, 4);
    setPinInput(next);
    setPinError(false);
    if (next.length === 4) {
      const h = await hashPin(next);
      if (h === (note as any)?.pinHash) {
        setPinLocked(false);
        setPinInput('');
      } else {
        setPinError(true);
        setTimeout(() => { setPinInput(''); setPinError(false); }, 600);
      }
    }
  };

  // ── PIN setup ───────────────────────────────────────────────────────────────
  const handlePinSetupDigit = async (d: string) => {
    const next = (pinSetupVal + d).slice(0, 4);
    setPinSetupVal(next);
    if (next.length === 4) {
      if (pinSetupStep === 'enter') {
        setPinSetupFirst(next);
        setPinSetupStep('confirm');
        setPinSetupVal('');
      } else {
        if (next === pinSetupFirst) {
          const h = await hashPin(next);
          await updateNote(noteId, { ...(note as any), pinHash: h });
          setShowPinSetup(false);
          setPinSetupStep('enter');
          setPinSetupFirst('');
          setPinSetupVal('');
          showToast('PIN set successfully.', 'success');
        } else {
          showToast('PINs don\'t match. Try again.', 'error');
          setPinSetupStep('enter');
          setPinSetupFirst('');
          setPinSetupVal('');
        }
      }
    }
  };

  const handleRemovePin = async () => {
    setShowContext(false);
    showConfirm({
      title: 'Remove PIN Lock',
      message: 'This note will no longer require a PIN to open.',
      confirmLabel: 'Remove',
      isDanger: true,
      onConfirm: async () => {
        const updated = { ...(note as any) };
        delete updated.pinHash;
        await updateNote(noteId, updated);
        showToast('PIN removed.', 'success');
      },
    });
  };

  if (noteNotFound) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 gap-6">
        <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-black text-[#111827]">Space not found</h2>
          <p className="text-sm text-gray-400 mt-1 max-w-[240px] leading-relaxed">This link may have expired or the space was deleted.</p>
        </div>
        <button onClick={onBack}
          className="px-6 py-3 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white text-sm font-bold rounded-2xl">
          Go back
        </button>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
          <p className="text-sm text-gray-400">Loading space…</p>
        </div>
      </div>
    );
  }

  // ── PIN lock screen ───────────────────────────────────────────────────────
  if (pinLocked) {
    const NUMPAD = [1,2,3,4,5,6,7,8,9,null,0,'⌫'] as const;
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 gap-7">
        <button onClick={onBack} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-[#374151]" />
        </button>

        <div className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-colors ${pinError ? 'bg-red-50' : 'bg-gray-100'}`}>
          <Lock className={`w-7 h-7 ${pinError ? 'text-red-500' : 'text-[#111827]'}`} />
        </div>

        <div className="text-center">
          <h2 className="text-lg font-black text-[#111827]">Locked</h2>
          <p className="text-sm text-gray-400 mt-0.5">{(note as any)?.title || 'This note'}</p>
        </div>

        {/* 4 dot indicator */}
        <div className={`flex gap-3 transition-all ${pinError ? 'animate-shake' : ''}`}>
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all ${
              pinError ? 'bg-red-400' : pinInput.length > i ? 'bg-[#111827] scale-110' : 'border-2 border-gray-300'
            }`} />
          ))}
        </div>

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {NUMPAD.map((n, i) => {
            if (n === null) return <div key={i} />;
            if (n === '⌫') return (
              <button key={i} onClick={() => { setPinInput(p => p.slice(0,-1)); setPinError(false); }}
                className="h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-lg font-semibold text-[#374151] active:scale-95 transition-transform">
                {n}
              </button>
            );
            return (
              <button key={i} onClick={() => handlePinDigit(String(n))}
                className="h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-xl font-bold text-[#111827] active:scale-95 active:bg-gray-200 transition-all">
                {n}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Main editor ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm px-4 py-3 flex items-center gap-2.5">
        <button onClick={handleSave} aria-label="Save and go back"
          className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center shrink-0">
          <ChevronLeft className="w-5 h-5 text-[#374151]" />
        </button>

        <div className="flex-1" />

        {/* Note size chip — shown for all users */}
        {(() => {
          const noteBytes = attachments.reduce((s, a) => s + (a.fileSizeBytes ?? 0), 0);
          return (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-transparent bg-gray-100 text-[10px] font-semibold text-[#6B7280]">
              <HardDrive className="w-3 h-3" />
              {noteBytes > 0 ? formatBytes(noteBytes) : 'Empty'}
            </div>
          );
        })()}

        {/* Sync status */}
        <AnimatePresence mode="wait">
          {saveStatus === 'saving' ? (
            <motion.div key="saving"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100">
              <svg className="w-3 h-3 animate-spin text-[#6B7280]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span className="text-[10px] font-semibold text-[#6B7280]">Saving…</span>
            </motion.div>
          ) : saveStatus === 'error' ? (
            <motion.div key="error"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 cursor-pointer"
              onClick={() => scheduleAutoSave()}>
              <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              <span className="text-[10px] font-semibold text-red-500">Not saved — tap to retry</span>
            </motion.div>
          ) : (
            <motion.div key="saved"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100">
              <svg className="w-3 h-3 text-[#22C55E]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              <span className="text-[10px] font-semibold text-[#6B7280]">Synced</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={() => setShowContext(true)} aria-label="More options"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <MoreHorizontal className="w-4 h-4 text-[#374151]" />
        </button>
      </header>

      {/* ── SCROLLABLE CONTENT ── */}
      <main className="flex-1 px-5 pb-56 overflow-y-auto">
        <div className="flex items-center gap-1.5 mt-2 mb-3">
          <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span className="text-[10px] text-gray-400">Last edited {fmtDate((note as any).updatedAt || new Date().toISOString())}</span>
        </div>

        {/* Title */}
        <div
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox" aria-multiline="false" aria-label="Space title"
          data-placeholder="Title"
          className="clipo-title text-[1.75rem] font-black text-[#111827] leading-tight mb-4 min-h-[2.2rem] break-words"
          onInput={() => scheduleAutoSave()}
        />

        {/* Body */}
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox" aria-multiline="true" aria-label="Space content"
          data-placeholder="Start writing…"
          className="clipo-richtext text-[15px] text-[#374151] leading-relaxed min-h-[80px] break-words"
          onInput={() => scheduleAutoSave()}
          onKeyDown={() => {
            if (activeTab) setActiveTab(null);
          }}
        />

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-col gap-3 mt-5">
            {attachments.map((att, idx) => (
              <div
                key={att.id}
                className="relative"
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
              >
                {/* Reorder + delete controls */}
                <div className="absolute -top-2 right-0 z-10 flex items-center gap-1">
                  {/* Drag handle */}
                  <div aria-label="Drag to reorder"
                    className="w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-3 h-3 text-gray-400" />
                  </div>
                  {idx > 0 && (
                    <button onClick={() => moveAttachment(att.id, 'up')} aria-label="Move up"
                      className="w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                      <ChevronUp className="w-3 h-3 text-gray-500" />
                    </button>
                  )}
                  {idx < attachments.length - 1 && (
                    <button onClick={() => moveAttachment(att.id, 'down')} aria-label="Move down"
                      className="w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                      <ChevronDown className="w-3 h-3 text-gray-500" />
                    </button>
                  )}
                  <button onClick={() => removeAttachment(att.id)} aria-label="Remove"
                    className="w-6 h-6 rounded-full bg-white border border-red-100 shadow-sm flex items-center justify-center">
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                </div>

                {/* Voice */}
                {att.type === 'voice' && (
                  <div className="relative">
                    <button onClick={() => att.content && toggleAudio(att)}
                      aria-label={playingId === att.id ? 'Pause' : 'Play'}
                      className="w-full bg-gradient-to-br from-[#111827] to-[#7C3AED] rounded-2xl px-4 py-3.5 flex items-center gap-3"
                      disabled={!att.content}>
                      <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shrink-0">
                        {!att.content
                          ? <Loader2 className="w-3.5 h-3.5 text-[#111827] animate-spin" />
                          : playingId === att.id
                            ? <Pause className="w-3.5 h-3.5 fill-[#111827] text-[#111827]" />
                            : <Play  className="w-3.5 h-3.5 fill-[#111827] text-[#111827] translate-x-0.5" />
                        }
                      </div>
                      <WaveformBars waveform={att.waveform ?? Array(30).fill(40)} playing={playingId === att.id} />
                      <span className="text-white/80 text-xs font-medium shrink-0">{fmtDuration(att.duration ?? 0)}</span>
                    </button>
                  </div>
                )}

                {/* Image */}
                {att.type === 'image' && (
                  <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm relative">
                    {att.content
                      ? <img src={att.content} alt={att.fileName || 'Image'} className="w-full object-cover max-h-72" />
                      : <div className="w-full h-32 bg-gray-100 animate-pulse" />
                    }
                    {uploadProgress[att.id] !== undefined && (
                      <UploadProgress pct={uploadProgress[att.id]} />
                    )}
                    <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                      <span className="text-xs text-gray-500 truncate">{att.fileName || 'Image'}</span>
                      <div className="flex items-center gap-1">
                        {att.isDrawing && att.content && (
                          <button
                            onClick={() => { setEditingDrawingId(att.id); setShowDrawing(true); }}
                            aria-label="Edit drawing"
                            className="w-6 h-6 flex items-center justify-center text-[#7C3AED] hover:bg-purple-50 rounded-lg transition-colors">
                            <PenLine className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {att.content && !att.isDrawing && (
                          <a href={att.content} download={att.fileName} aria-label="Download"
                            className="w-6 h-6 flex items-center justify-center text-gray-400">
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Video */}
                {att.type === 'video' && (
                  <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm relative">
                    {att.content
                      ? <video src={att.content} controls className="w-full max-h-64 bg-black" />
                      : <div className="w-full h-32 bg-gray-900 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                    }
                    {uploadProgress[att.id] !== undefined && (
                      <UploadProgress pct={uploadProgress[att.id]} />
                    )}
                    {att.fileName && (
                      <div className="px-3 py-2 bg-gray-50">
                        <span className="text-xs text-gray-500">{att.fileName}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* File */}
                {att.type === 'file' && (
                  <div className="bg-[#F9FAFB] rounded-2xl border border-gray-200 px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                      {uploadProgress[att.id] !== undefined
                        ? <Loader2 className="w-5 h-5 text-[#7C3AED] animate-spin" />
                        : <FileText className="w-5 h-5 text-[#111827]" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111827] truncate">{att.fileName || 'File'}</p>
                      {att.fileSize && <p className="text-xs text-gray-400">{att.fileSize}</p>}
                      {uploadProgress[att.id] !== undefined && (
                        <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#111827] to-[#7C3AED] rounded-full transition-all"
                            style={{ width: `${uploadProgress[att.id]}%` }} />
                        </div>
                      )}
                    </div>
                    {att.content && (
                      <a href={att.content} download={att.fileName || 'file'} aria-label="Download"
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#111827] shrink-0">
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}

                {/* Link */}
                {att.type === 'link' && (
                  <a href={att.content} target="_blank" rel="noopener noreferrer"
                    className="block bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-[#7C3AED]/40 transition-all shadow-sm">
                    {att.linkImage && <img src={att.linkImage} alt="" className="w-full h-32 object-cover" />}
                    <div className="p-3.5">
                      <p className="text-sm font-bold text-[#111827] line-clamp-1">{att.linkTitle || att.content}</p>
                      {att.linkDescription && (
                        <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{att.linkDescription}</p>
                      )}
                      <p className="text-[10px] text-[#7C3AED] mt-1.5 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {att.content.replace(/^https?:\/\//, '').slice(0, 40)}
                      </p>
                    </div>
                  </a>
                )}

                {/* Checklist */}
                {att.type === 'checklist' && (
                  <ChecklistBlock att={att}
                    onToggle={toggleCheckItem} onAddItem={addCheckItem} onDeleteItem={deleteCheckItem} onRenameItem={renameCheckItem} />
                )}

                {/* Code */}
                {att.type === 'code' && (
                  <CodeBlock att={att} onChange={content => {
                    const updated = attachments.map(a => a.id === att.id ? { ...a, content } : a);
                    setAttachments(updated);
                    scheduleAutoSave(updated);
                  }} onLanguageChange={lang => {
                    const updated = attachments.map(a => a.id === att.id ? { ...a, codeLanguage: lang } : a);
                    setAttachments(updated);
                    scheduleAutoSave(updated);
                  }} />
                )}

                {/* Text block */}
                {att.type === 'text' && (
                  <textarea
                    className="w-full text-sm text-[#111827] bg-transparent outline-none resize-none placeholder:text-gray-300 leading-relaxed"
                    value={att.content}
                    placeholder="Write something..."
                    rows={1}
                    onChange={e => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                      const updated = attachments.map(a => a.id === att.id ? { ...a, content: e.target.value } : a);
                      setAttachments(updated);
                      scheduleAutoSave(updated);
                    }}
                    onInput={e => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = el.scrollHeight + 'px';
                    }}
                  />
                )}

                {/* Divider */}
                {att.type === 'divider' && (
                  <div className="py-2 px-1">
                    <div className="h-px bg-gradient-to-r from-transparent via-[#D1D5DB] to-transparent" />
                  </div>
                )}

                {/* Bullet list */}
                {att.type === 'bullet' && (
                  <div className="py-1 flex flex-col gap-0.5">
                    {(att.listItems ?? ['']).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 group/li">
                        <Circle className="w-2 h-2 text-[#7C3AED] shrink-0 fill-[#7C3AED]" />
                        <input
                          className="flex-1 text-sm text-[#111827] bg-transparent outline-none placeholder:text-gray-300"
                          value={item}
                          placeholder="List item"
                          onChange={e => updateListItem(att.id, idx, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); addListItem(att.id); }
                            if (e.key === 'Backspace' && item === '' && (att.listItems?.length ?? 0) > 1) {
                              e.preventDefault(); removeListItem(att.id, idx);
                            }
                          }}
                        />
                        <button onClick={() => removeListItem(att.id, idx)}
                          className="opacity-0 group-hover/li:opacity-100 transition-opacity text-gray-300 hover:text-red-400 shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addListItem(att.id)}
                      className="flex items-center gap-2 text-[11px] text-[#9CA3AF] hover:text-[#7C3AED] transition-colors mt-1 w-fit">
                      <Plus className="w-3 h-3" /> Add item
                    </button>
                  </div>
                )}

                {/* Numbered list */}
                {att.type === 'numbered' && (
                  <div className="py-1 flex flex-col gap-0.5">
                    {(att.listItems ?? ['']).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 group/li">
                        <span className="text-xs font-bold text-[#7C3AED] shrink-0 w-4 text-right">{idx + 1}.</span>
                        <input
                          className="flex-1 text-sm text-[#111827] bg-transparent outline-none placeholder:text-gray-300"
                          value={item}
                          placeholder="List item"
                          onChange={e => updateListItem(att.id, idx, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); addListItem(att.id); }
                            if (e.key === 'Backspace' && item === '' && (att.listItems?.length ?? 0) > 1) {
                              e.preventDefault(); removeListItem(att.id, idx);
                            }
                          }}
                        />
                        <button onClick={() => removeListItem(att.id, idx)}
                          className="opacity-0 group-hover/li:opacity-100 transition-opacity text-gray-300 hover:text-red-400 shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addListItem(att.id)}
                      className="flex items-center gap-2 text-[11px] text-[#9CA3AF] hover:text-[#7C3AED] transition-colors mt-1 w-fit">
                      <Plus className="w-3 h-3" /> Add item
                    </button>
                  </div>
                )}

                {/* Table */}
                {att.type === 'table' && att.tableData && (
                  <div className="py-1">
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full border-collapse text-sm" style={{ minWidth: att.tableData.cols * 96 }}>
                        <tbody>
                          {att.tableData.cells.map((row, ri) => (
                            <tr key={ri} className="group/row">
                              {row.map((cell, ci) => (
                                <td key={ci}
                                  className={`border border-gray-200 p-0 relative ${ri === 0 && att.tableData!.hasHeader ? 'bg-[#F3F0FF]' : 'bg-white'}`}>
                                  <input
                                    className={`w-full px-2 py-1.5 text-xs bg-transparent outline-none min-w-[80px]
                                      ${ri === 0 && att.tableData!.hasHeader ? 'font-semibold text-[#374151]' : 'text-[#374151]'}`}
                                    value={cell}
                                    placeholder={ri === 0 && att.tableData!.hasHeader ? `Col ${ci + 1}` : ''}
                                    onChange={e => updateTableCell(att.id, ri, ci, e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Tab') {
                                        e.preventDefault();
                                        const totalCells = att.tableData!.rows * att.tableData!.cols;
                                        const currentIdx = ri * att.tableData!.cols + ci;
                                        const nextIdx = (currentIdx + 1) % totalCells;
                                        const nextRow = Math.floor(nextIdx / att.tableData!.cols);
                                        const nextCol = nextIdx % att.tableData!.cols;
                                        const inputs = e.currentTarget.closest('table')?.querySelectorAll('input');
                                        (inputs?.[nextRow * att.tableData!.cols + nextCol] as HTMLInputElement)?.focus();
                                      }
                                    }}
                                  />
                                </td>
                              ))}
                              {/* Delete row button */}
                              <td className="border-0 p-0 w-5">
                                {att.tableData.rows > 1 && (
                                  <button onClick={() => removeTableRow(att.id, ri)}
                                    className="opacity-0 group-hover/row:opacity-100 transition-opacity w-5 h-full flex items-center justify-center text-gray-300 hover:text-red-400">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {/* Delete col row */}
                          <tr>
                            {att.tableData.cells[0].map((_, ci) => (
                              <td key={ci} className="border-0 p-0 h-5">
                                {att.tableData!.cols > 1 && (
                                  <button onClick={() => removeTableCol(att.id, ci)}
                                    className="w-full flex items-center justify-center text-gray-300 hover:text-red-400 opacity-0 hover:opacity-100 transition-opacity h-5">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </td>
                            ))}
                            <td />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {/* Table actions */}
                    <div className="flex items-center gap-3 mt-2">
                      <button onClick={() => addTableRow(att.id)}
                        className="flex items-center gap-1 text-[11px] text-[#9CA3AF] hover:text-[#7C3AED] transition-colors">
                        <Plus className="w-3 h-3" /> Row
                      </button>
                      <button onClick={() => addTableCol(att.id)}
                        className="flex items-center gap-1 text-[11px] text-[#9CA3AF] hover:text-[#7C3AED] transition-colors">
                        <Plus className="w-3 h-3" /> Column
                      </button>
                      <button onClick={() => toggleTableHeader(att.id)}
                        className={`flex items-center gap-1 text-[11px] transition-colors ${att.tableData.hasHeader ? 'text-[#7C3AED]' : 'text-[#9CA3AF] hover:text-[#7C3AED]'}`}>
                        Header {att.tableData.hasHeader ? 'on' : 'off'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── BOTTOM TOOLBAR ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20">

        <AnimatePresence>
          {activeTab && (
            <motion.div key={activeTab}
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t border-gray-100 bg-[#FAFAFA]"
            >
              {/* ── MEDIA ── */}
              {activeTab === 'media' && (
                <div className="flex items-center gap-2 px-4 py-3">
                  {[
                    { icon: <Type className="w-5 h-5" />,      label: 'Text',  bg: 'bg-green-50 text-green-600',  action: () => { addAttachment({ id: uid(), type: 'text', content: '' }); setActiveTab(null); } },
                    { icon: <ImageIcon className="w-5 h-5" />, label: 'Image', bg: 'bg-blue-50 text-blue-600',    action: () => triggerFile('image') },
                    { icon: <VideoIcon className="w-5 h-5" />, label: 'Video', bg: 'bg-purple-50 text-purple-600', action: () => triggerFile('video') },
                    { icon: <FileText className="w-5 h-5" />,  label: 'File',  bg: 'bg-amber-50 text-amber-600',  action: () => triggerFile('file') },
                    { icon: <Mic className="w-5 h-5" />,       label: 'Voice', bg: 'bg-rose-50 text-rose-600',    action: () => { setShowVoice(true); setActiveTab(null); } },
                    { icon: <LinkIcon className="w-5 h-5" />,  label: 'Link',  bg: 'bg-cyan-50 text-cyan-600',    action: () => { setLinkInput(''); setShowLinkSheet(true); setActiveTab(null); } },
                  ].map(opt => (
                    <button key={opt.label} onClick={opt.action} aria-label={`Add ${opt.label}`}
                      className="flex-1 flex flex-col items-center gap-1.5 py-1.5">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${opt.bg}`}>
                        {opt.icon}
                      </div>
                      <span className="text-[10px] font-semibold text-[#374151]">{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ── LIST ── */}
              {activeTab === 'list' && (
                <div className="flex items-center gap-2 px-4 py-3">
                  {[
                    { icon: <ListChecks className="w-5 h-5" />,   label: 'Checklist', bg: 'bg-indigo-50 text-indigo-600',
                      action: () => addAttachment({ id: uid(), type: 'checklist', content: '', checklistItems: [] }) },
                    { icon: <Hash className="w-5 h-5" />,          label: 'Subhead',   bg: 'bg-emerald-50 text-emerald-600',
                      action: () => {
                        const last = [...attachments].reverse().find(a => a.type === 'checklist');
                        if (last) { addCheckItem(last.id, 'Section', true); setActiveTab(null); }
                        else addAttachment({ id: uid(), type: 'checklist', content: '', checklistItems: [{ id: uid(), text: 'Section', completed: false, isSection: true }] });
                      }},
                    { icon: <List className="w-5 h-5" />,          label: 'Bullet',    bg: 'bg-violet-50 text-violet-600',
                      action: () => addAttachment({ id: uid(), type: 'bullet', content: '', listItems: [''] }) },
                    { icon: <ListNumbered className="w-5 h-5" />,  label: 'Numbered',  bg: 'bg-blue-50 text-blue-600',
                      action: () => addAttachment({ id: uid(), type: 'numbered', content: '', listItems: [''] }) },
                    { icon: <Table2 className="w-5 h-5" />,        label: 'Table',     bg: 'bg-orange-50 text-orange-600',
                      action: () => addAttachment({ id: uid(), type: 'table', content: '',
                        tableData: { rows: 2, cols: 3, cells: [['','',''],['','','']], hasHeader: true } }) },
                    { icon: <Minus className="w-5 h-5" />,         label: 'Divider',   bg: 'bg-gray-100 text-gray-500',
                      action: () => addAttachment({ id: uid(), type: 'divider', content: '' }) },
                  ].map(opt => (
                    <button key={opt.label} onClick={opt.action} aria-label={opt.label}
                      className="flex-1 flex flex-col items-center gap-1.5 py-1.5">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${opt.bg}`}>
                        {opt.icon}
                      </div>
                      <span className="text-[10px] font-semibold text-[#374151]">{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ── FORMAT ── */}
              {activeTab === 'format' && (
                <div className="px-4 pt-3 pb-3 flex flex-col gap-3">

                  {/* Row 1 — Highlight */}
                  <div className="flex items-center gap-0">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider w-14 shrink-0">Highlight</span>
                    <div className="flex items-center gap-2">
                      {[
                        { bg: '#FEF08A', label: 'Yellow' },
                        { bg: '#EDE9FE', label: 'Purple' },
                        { bg: '#DCFCE7', label: 'Green' },
                        { bg: '#FED7AA', label: 'Orange' },
                        { bg: '#FCE7F3', label: 'Pink' },
                      ].map(h => (
                        <button key={h.label}
                          onMouseDown={e => { e.preventDefault(); bodyRef.current?.focus(); document.execCommand('backColor', false, h.bg); }}
                          aria-label={`Highlight ${h.label}`}
                          className="w-7 h-7 rounded-full border-2 border-white shadow-sm shrink-0"
                          style={{ backgroundColor: h.bg }} />
                      ))}
                      <button
                        onMouseDown={e => { e.preventDefault(); bodyRef.current?.focus(); document.execCommand('backColor', false, 'transparent'); }}
                        aria-label="Clear highlight"
                        className="w-7 h-7 rounded-full border border-gray-200 bg-white flex items-center justify-center shrink-0">
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  <div className="h-px bg-gray-100" />

                  {/* Row 2 — Text style + Headings + Indent */}
                  <div className="flex items-center gap-0">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider w-14 shrink-0">Style</span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { icon: <Bold className="w-4 h-4" />,          cmd: 'bold',              val: undefined, label: 'Bold' },
                        { icon: <Italic className="w-4 h-4" />,        cmd: 'italic',            val: undefined, label: 'Italic' },
                        { icon: <Underline className="w-4 h-4" />,     cmd: 'underline',         val: undefined, label: 'Underline' },
                        { icon: <Strikethrough className="w-4 h-4" />, cmd: 'strikeThrough',     val: undefined, label: 'Strike' },
                      ].map(f => (
                        <button key={f.cmd}
                          onMouseDown={e => { e.preventDefault(); execFormat(f.cmd, f.val); }}
                          aria-label={f.label}
                          className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-[#374151] active:bg-[#111827] active:text-white transition-colors shrink-0">
                          {f.icon}
                        </button>
                      ))}
                      <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
                      {[
                        { icon: <Heading1 className="w-4 h-4" />, cmd: 'formatBlock', val: 'h1', label: 'H1' },
                        { icon: <Heading2 className="w-4 h-4" />, cmd: 'formatBlock', val: 'h2', label: 'H2' },
                        { icon: <Heading3 className="w-4 h-4" />, cmd: 'formatBlock', val: 'h3', label: 'H3' },
                      ].map(f => (
                        <button key={f.label}
                          onMouseDown={e => { e.preventDefault(); execFormat(f.cmd, f.val); }}
                          aria-label={f.label}
                          className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-[#374151] active:bg-[#111827] active:text-white transition-colors shrink-0">
                          {f.icon}
                        </button>
                      ))}
                      <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
                      {[
                        { icon: <Indent className="w-4 h-4" />,  cmd: 'indent',  val: undefined, label: 'Indent' },
                        { icon: <Outdent className="w-4 h-4" />, cmd: 'outdent', val: undefined, label: 'Outdent' },
                      ].map(f => (
                        <button key={f.label}
                          onMouseDown={e => { e.preventDefault(); execFormat(f.cmd, f.val); }}
                          aria-label={f.label}
                          className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-[#374151] active:bg-[#111827] active:text-white transition-colors shrink-0">
                          {f.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-px bg-gray-100" />

                  {/* Row 3 — Align */}
                  <div className="flex items-center gap-0">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider w-14 shrink-0">Align</span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { icon: <AlignLeft className="w-4 h-4" />,    cmd: 'justifyLeft',   label: 'Left' },
                        { icon: <AlignCenter className="w-4 h-4" />,  cmd: 'justifyCenter', label: 'Center' },
                        { icon: <AlignRight className="w-4 h-4" />,   cmd: 'justifyRight',  label: 'Right' },
                        { icon: <AlignJustify className="w-4 h-4" />, cmd: 'justifyFull',   label: 'Justify' },
                      ].map(f => (
                        <button key={f.cmd}
                          onMouseDown={e => { e.preventDefault(); execFormat(f.cmd); }}
                          aria-label={f.label}
                          className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-[#374151] active:bg-[#111827] active:text-white transition-colors shrink-0">
                          {f.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab bar */}
        <div className="flex items-stretch border-t border-gray-100">
          {([
            { id: 'media'  as ToolTab, icon: <Plus className="w-5 h-5" />,       label: 'Media' },
            { id: 'list'   as ToolTab, icon: <ListChecks className="w-5 h-5" />, label: 'Blocks' },
            { id: null,                icon: <PenLine className="w-5 h-5" />,     label: 'Draw', draw: true },
            { id: 'format' as ToolTab, icon: <Type className="w-5 h-5" />,        label: 'Format' },
            { id: null, icon: <Code className="w-5 h-5" />, label: 'Code', code: true },
          ] as const).map(item => {
            const isActive = !('draw' in item) && !('code' in item) && activeTab === item.id;
            return (
              <button
                key={item.label}
                onClick={() => {
                  if ('draw' in item) { setShowDrawing(true); setActiveTab(null); return; }
                  if ('code' in item) { addAttachment({ id: uid(), type: 'code', content: '', codeLanguage: 'javascript' }); setActiveTab(null); return; }
                  setActiveTab(prev => prev === item.id ? null : (item.id as ToolTab));
                }}
                aria-label={item.label}
                aria-pressed={isActive}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${
                  isActive ? 'text-[#111827] bg-gray-50' : 'text-[#6B7280]'
                }`}
              >
                {item.icon}
                <span className="text-[9px] font-semibold">{item.label}</span>
                {isActive && <span className="w-4 h-0.5 rounded-full bg-gradient-to-r from-[#111827] to-[#7C3AED] mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept={ALLOWED_TYPES.image.join(',')} className="hidden"
        onChange={e => handleFileSelected('image', e.target.files?.[0])} />
      <input ref={videoInputRef} type="file" accept={ALLOWED_TYPES.video.join(',')} className="hidden"
        onChange={e => handleFileSelected('video', e.target.files?.[0])} />
      <input ref={fileInputRef}  type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv" className="hidden"
        onChange={e => handleFileSelected('file', e.target.files?.[0])} />

      {/* ═══ SHEETS ═══ */}

      {/* Context menu */}
      <Sheet open={showContext} onClose={() => setShowContext(false)}>
        <div className="px-4 pt-4 pb-2">
          <button onClick={openShare} className="w-full flex items-center gap-3.5 py-3.5 text-left">
            <Share2 className="w-4 h-4 text-[#374151] shrink-0" />
            <span className="flex-1 text-sm font-medium text-[#111827]">Share & Collaborate</span>
          </button>

          {/* PIN options */}
          {!(note as any)?.pinHash ? (
            <button onClick={() => { setShowContext(false); setPinSetupStep('enter'); setPinSetupVal(''); setPinSetupFirst(''); setShowPinSetup(true); }}
              className="w-full flex items-center gap-3.5 py-3.5 border-t border-gray-50 text-left">
              <Lock className="w-4 h-4 text-[#374151] shrink-0" />
              <span className="flex-1 text-sm font-medium text-[#111827]">Set PIN Lock</span>
            </button>
          ) : (
            <>
              <button onClick={() => { setShowContext(false); setPinSetupStep('enter'); setPinSetupVal(''); setPinSetupFirst(''); setShowPinSetup(true); }}
                className="w-full flex items-center gap-3.5 py-3.5 border-t border-gray-50 text-left">
                <KeyRound className="w-4 h-4 text-[#374151] shrink-0" />
                <span className="flex-1 text-sm font-medium text-[#111827]">Change PIN</span>
              </button>
              <button onClick={handleRemovePin}
                className="w-full flex items-center gap-3.5 py-3.5 border-t border-gray-50 text-left">
                <Unlock className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="flex-1 text-sm font-medium text-amber-600">Remove PIN Lock</span>
              </button>
            </>
          )}

          <button onClick={handleDelete} className="w-full flex items-center gap-3.5 py-3.5 border-t border-gray-50">
            <Trash2 className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-red-500 flex-1 text-left">Delete Space</span>
          </button>
          <p className="text-[10px] text-gray-300 text-center py-3 border-t border-gray-50 mt-1">
            Last edited {fmtDate((note as any).updatedAt || new Date().toISOString())}
          </p>
        </div>
      </Sheet>

      {/* Voice recorder */}
      <Sheet open={showVoice} onClose={() => setShowVoice(false)} title="Voice Note">
        <VoiceRecorder
          onSave={handleVoiceSave}
          onCancel={() => setShowVoice(false)}
        />
      </Sheet>

      {/* Add link sheet */}
      <Sheet open={showLinkSheet} onClose={() => setShowLinkSheet(false)} title="Add Link">
        <div className="px-4 pt-2 pb-8 flex flex-col gap-3">
          <input
            type="url"
            value={linkInput}
            onChange={e => setLinkInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); }}
            placeholder="https://…"
            autoFocus
            className="w-full bg-[#F9FAFB] border border-gray-200 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10"
          />
          <button
            onClick={handleAddLink}
            disabled={!linkInput.trim() || linkLoading}
            className="w-full py-3.5 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white font-bold rounded-2xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {linkLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {linkLoading ? 'Fetching preview…' : 'Add Link'}
          </button>
        </div>
      </Sheet>

      {/* Exit warning */}
      <AnimatePresence>
        {showExitWarn && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowExitWarn(false)} />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: 'spring', damping: 24, stiffness: 340 }}
              className="relative w-full max-w-xs bg-white rounded-3xl p-6 flex flex-col gap-4 z-10 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-sm font-black text-[#111827] mb-1">Still saving…</h3>
                <p className="text-xs text-gray-400 leading-relaxed">Your changes are being saved. Leave now and they'll be saved automatically.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowExitWarn(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-[#374151]">Wait</button>
                <button onClick={() => { setShowExitWarn(false); doSaveAndBack(); }}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white text-sm font-bold">Leave</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share sheet */}
      {note && (
        <ShareSheet
          open={showShare}
          onClose={() => setShowShare(false)}
          note={note as any}
          isOwner={(note as any).ownerId === user?.uid}
        />
      )}

      {/* PIN Setup sheet */}
      <Sheet open={showPinSetup} onClose={() => setShowPinSetup(false)}
        title={pinSetupStep === 'enter' ? 'Set a PIN' : 'Confirm PIN'}>
        <div className="px-6 pb-10 pt-4 flex flex-col items-center gap-6">
          <p className="text-xs text-gray-400 text-center">
            {pinSetupStep === 'enter' ? 'Enter a 4-digit PIN to lock this note.' : 'Enter the PIN again to confirm.'}
          </p>
          {/* 4 dot indicator */}
          <div className="flex gap-3">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all ${
                pinSetupVal.length > i ? 'bg-[#111827] scale-110' : 'border-2 border-gray-300'
              }`} />
            ))}
          </div>
          {/* Number pad */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
            {([1,2,3,4,5,6,7,8,9,null,0,'⌫'] as const).map((n, i) => {
              if (n === null) return <div key={i} />;
              if (n === '⌫') return (
                <button key={i} onClick={() => setPinSetupVal(p => p.slice(0,-1))}
                  className="h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-lg font-semibold text-[#374151] active:scale-95 transition-transform">
                  {n}
                </button>
              );
              return (
                <button key={i} onClick={() => handlePinSetupDigit(String(n))}
                  className="h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-xl font-bold text-[#111827] active:scale-95 active:bg-gray-200 transition-all">
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      </Sheet>

      {/* Drawing canvas */}
      <AnimatePresence>
        {showDrawing && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-50">
            <DrawingCanvas
              initialDataUrl={editingDrawingId
                ? attachments.find(a => a.id === editingDrawingId)?.content
                : undefined}
              onClose={() => { setShowDrawing(false); setEditingDrawingId(null); }}
              onSave={async (dataUrl) => {
                setShowDrawing(false);
                const isEdit = !!editingDrawingId;
                const attId = editingDrawingId ?? uid();
                setEditingDrawingId(null);

                // Delete old storage file if editing
                if (isEdit) {
                  const old = attachments.find(a => a.id === attId);
                  if (old?.storagePath) deleteFromStorage(old.storagePath);
                }

                const placeholder: Attachment = {
                  id: attId, type: 'image', content: '',
                  fileName: 'Drawing', isDrawing: true,
                };
                const withPlaceholder = isEdit
                  ? attachments.map(a => a.id === attId ? placeholder : a)
                  : [...attachments, placeholder];
                setAttachments(withPlaceholder);

                try {
                  const blob = await fetch(dataUrl).then(r => r.blob());
                  const { url, storagePath, bytes } = await uploadFile(
                    blob, user?.uid ?? 'anon', 'drawing.png',
                    (pct) => setUploadProgress(prev => ({ ...prev, [attId]: pct })));
                  setUploadProgress(prev => { const n = { ...prev }; delete n[attId]; return n; });
                  const finalAtts = withPlaceholder.map(a =>
                    a.id === attId ? { ...a, content: url, storagePath: storagePath || undefined, fileSizeBytes: bytes || undefined } : a);
                  setAttachments(finalAtts);
                  scheduleAutoSave(finalAtts);
                } catch {
                  showToast('Drawing upload failed.', 'error');
                  setAttachments(withPlaceholder.filter(a => a.id !== attId));
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotePage;
