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
  ExternalLink, Plus, Share2, Lock, Copy, Trash2,
  Image as ImageIcon, Mic, FileText, Link as LinkIcon, Video as VideoIcon,
  Code, PenLine, ListChecks, Type, Eye, EyeOff,
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, Indent, Outdent, Highlighter,
  ChevronUp, ChevronDown, X, Hash,
} from 'lucide-react';

// ─── File validation constants ────────────────────────────────────────────────
const ALLOWED_TYPES: Record<'image' | 'video' | 'file', string[]> = {
  image: ['image/jpeg','image/jpg','image/png','image/gif','image/webp','image/svg+xml'],
  video: ['video/mp4','video/webm','video/ogg','video/quicktime','video/x-msvideo'],
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
const MAX_MB: Record<'image' | 'video' | 'file', number> = { image: 10, video: 100, file: 50 };
const EXT_LABELS: Record<'image' | 'video' | 'file', string> = {
  image: 'JPG, PNG, GIF, WebP, SVG',
  video: 'MP4, WebM, OGG, MOV',
  file: 'PDF, DOC, XLS, PPT, TXT, ZIP, CSV',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtDuration = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });



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
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={onClose}
        />
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
      <div
        key={i}
        className={`flex-1 bg-white/80 rounded-full min-h-[15%] ${playing ? 'animate-equalizer' : ''}`}
        style={{
          height: `${Math.max(15, h)}%`,
          animationDelay: playing ? `${(i % 5) * 0.12}s` : undefined,
        }}
      />
    ))}
  </div>
);

// ─── Checklist block ──────────────────────────────────────────────────────────
const ChecklistBlock: React.FC<{
  att: Attachment;
  onToggle: (attId: string, itemId: string) => void;
  onAddItem: (attId: string, text: string, isSection?: boolean) => void;
  onDeleteItem: (attId: string, itemId: string) => void;
}> = ({ att, onToggle, onAddItem, onDeleteItem }) => {
  const [newText, setNewText] = useState('');
  const items = att.checklistItems ?? [];
  let sectionIdx = 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
      {items.map(item => {
        if (item.isSection) {
          sectionIdx++;
          const num = sectionIdx;
          return (
            <div key={item.id} className="flex items-center justify-between mt-2 first:mt-0">
              <span className="text-sm font-bold text-[#111827]">{num}. {item.text}</span>
              <button onClick={() => onDeleteItem(att.id, item.id)} aria-label="Remove section"
                className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        }
        return (
          <div key={item.id} className="flex items-center gap-3 group">
            <button onClick={() => onToggle(att.id, item.id)}
              aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
              className="shrink-0">
              {item.completed ? (
                <div className="w-5 h-5 rounded-full bg-[#111827] flex items-center justify-center">
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

      {/* Add new item row */}
      <div className="flex items-center gap-2 mt-1 pt-2 border-t border-gray-50">
        <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" />
        <input
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
          <button onClick={() => { onAddItem(att.id, newText.trim()); setNewText(''); }}
            aria-label="Add item"
            className="w-6 h-6 rounded-full bg-[#111827] flex items-center justify-center">
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
}

const NotePage: React.FC<NotePageProps> = ({ noteId, onBack }) => {
  const { notes, updateNote, deleteNote } = useNotes();
  const { showToast, showConfirm } = useUI();
  const note = notes.find(n => n.id === noteId);

  // ── Contenteditable refs (avoid cursor-reset by never re-setting innerHTML) ──
  const titleRef    = useRef<HTMLDivElement>(null);
  const bodyRef     = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // ── Local state ──────────────────────────────────────────────────────────────
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [notePassword, setNotePassword] = useState('');
  const [playingId, setPlayingId]     = useState<string | null>(null);
  const playAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sheet visibility
  const [showContext, setShowContext]       = useState(false);
  const [showVoice, setShowVoice]           = useState(false);
  const [showDrawing, setShowDrawing]       = useState(false);
  const [showLinkSheet, setShowLinkSheet]   = useState(false);
  const [linkInput, setLinkInput]           = useState('');
  const [showExitWarn, setShowExitWarn]     = useState(false);

  // Bottom toolbar active tab ('media' | 'list' | 'format' | 'code' | null)
  type ToolTab = 'media' | 'list' | 'format' | 'code';
  const [activeTab, setActiveTab] = useState<ToolTab | null>(null);
  const [codeLang, setCodeLang]   = useState('javascript');

  // Save status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  // Lock screen
  const [locked, setLocked]           = useState(false);
  const [unlockInput, setUnlockInput] = useState('');
  const [showUnlockPw, setShowUnlockPw] = useState(false);

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  // Auto-save timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    initialized.current = false;
  }, [noteId]);

  useEffect(() => {
    if (!note) return;
    if (!initialized.current) {
      if (titleRef.current)  titleRef.current.textContent  = note.title   || '';
      if (bodyRef.current)   bodyRef.current.innerHTML     = note.content  || '';
      initialized.current = true;
    }
    setAttachments(note.attachments ?? []);
    setNotePassword(note.password ?? '');
    const key = `clipo_verified_${noteId}`;
    if (note.password && !sessionStorage.getItem(key)) setLocked(true);
  }, [note, noteId]);


  // ── Auto-save ─────────────────────────────────────────────────────────────────
  const scheduleAutoSave = useCallback((newAtts?: Attachment[]) => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const title   = titleRef.current?.textContent?.trim() || '';
      const content = bodyRef.current?.innerHTML || '';
      updateNote(noteId, {
        title, content,
        attachments: newAtts ?? attachments,
        updatedAt: new Date().toISOString(),
      });
      setSaveStatus('saved');
    }, 1000);
  }, [noteId, updateNote, attachments]);

  // ── Save + back ───────────────────────────────────────────────────────────────
  const doSaveAndBack = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const title   = titleRef.current?.textContent?.trim() || '';
    const content = bodyRef.current?.innerHTML || '';
    updateNote(noteId, { title, content, attachments, updatedAt: new Date().toISOString() });
    setSaveStatus('saved');
    onBack();
  };

  const handleSave = () => {
    if (saveStatus === 'saving') { setShowExitWarn(true); return; }
    doSaveAndBack();
  };

  // ── Unlock ───────────────────────────────────────────────────────────────────
  const handleUnlock = () => {
    if (unlockInput === notePassword) {
      sessionStorage.setItem(`clipo_verified_${noteId}`, '1');
      setLocked(false);
      setUnlockInput('');
    } else {
      showToast('Incorrect password', 'error');
    }
  };

  // ── Attachments ───────────────────────────────────────────────────────────────
  const addAttachment = (att: Attachment) => {
    const next = [...attachments, att];
    setAttachments(next);
    scheduleAutoSave(next);
    setActiveTab(null);
    setShowVoice(false);
  };

  const removeAttachment = (id: string) => {
    showConfirm({
      title: 'Remove this item?',
      message: '',
      onConfirm: () => {
        const next = attachments.filter(a => a.id !== id);
        setAttachments(next);
        scheduleAutoSave(next);
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

  // ── File upload ───────────────────────────────────────────────────────────────
  const triggerFile = (type: 'image' | 'video' | 'file') => {
    const ref = type === 'image' ? imageInputRef : type === 'video' ? videoInputRef : fileInputRef;
    if (ref.current) { ref.current.value = ''; ref.current.click(); }
    setActiveTab(null);
  };

  const handleFileSelected = (type: 'image' | 'video' | 'file', file?: File) => {
    if (!file) return;
    if (!ALLOWED_TYPES[type].includes(file.type)) {
      showToast(`Unsupported format. Allowed: ${EXT_LABELS[type]}`, 'error'); return;
    }
    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > MAX_MB[type]) {
      showToast(`File too large. Max ${MAX_MB[type]} MB for ${type}s.`, 'error'); return;
    }
    if (type === 'image') {
      const reader = new FileReader();
      reader.onload = e => addAttachment({
        id: uid(), type: 'image', content: e.target?.result as string,
        fileName: file.name, fileSize: `${sizeMB.toFixed(1)} MB`,
      });
      reader.readAsDataURL(file);
    } else if (type === 'video') {
      addAttachment({ id: uid(), type: 'video', content: URL.createObjectURL(file),
        fileName: file.name, fileSize: `${sizeMB.toFixed(1)} MB` });
    } else {
      addAttachment({ id: uid(), type: 'file', content: '',
        fileName: file.name, fileSize: `${sizeMB.toFixed(1)} MB`, fileType: file.type });
    }
  };

  // ── Audio playback ────────────────────────────────────────────────────────────
  const toggleAudio = (att: Attachment) => {
    if (playingId === att.id) {
      playAudioRef.current?.pause();
      setPlayingId(null);
    } else {
      playAudioRef.current?.pause();
      const audio = new Audio(att.content);
      audio.onended = () => setPlayingId(null);
      playAudioRef.current = audio;
      audio.play();
      setPlayingId(att.id);
    }
  };

  // ── Rich text formatting ──────────────────────────────────────────────────────
  const execFormat = (cmd: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value ?? undefined);
  };

  // ── Share ────────────────────────────────────────────────────────────────────
  const shareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?share=${noteId}`;
    navigator.clipboard.writeText(url).then(() => showToast('Share link copied!', 'success'));
    setShowContext(false);
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    setShowContext(false);
    showConfirm({
      title: 'Delete Space',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      isDanger: true,
      onConfirm: () => {
        deleteNote(noteId);
        onBack();
      },
    });
  };

  // ── Lock screen ──────────────────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 gap-6">
        <div className="w-16 h-16 rounded-3xl bg-[#F3F4F6] flex items-center justify-center">
          <Lock className="w-7 h-7 text-[#6B7280]" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-black text-[#111827]">Protected Space</h2>
          <p className="text-sm text-gray-400 mt-1">Enter the password to access this space</p>
        </div>
        <div className="w-full max-w-xs relative">
          <input
            type={showUnlockPw ? 'text' : 'password'}
            value={unlockInput}
            onChange={e => setUnlockInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
            placeholder="Password"
            autoFocus
            className="w-full bg-[#F9FAFB] border border-gray-200 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/10 pr-12"
          />
          <button onClick={() => setShowUnlockPw(p => !p)} aria-label="Toggle password"
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            {showUnlockPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button onClick={handleUnlock} disabled={!unlockInput}
          className="w-full max-w-xs py-3.5 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white font-bold rounded-2xl disabled:opacity-40">
          Unlock
        </button>
        <button onClick={onBack} className="text-sm text-gray-400">Go back</button>
      </div>
    );
  }

  if (!note) return null;

  // ── Main editor ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm px-4 py-3 flex items-center gap-2.5">
        {/* Back / save */}
        <button onClick={handleSave} aria-label="Save and go back"
          className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center shrink-0">
          <ChevronLeft className="w-5 h-5 text-[#374151]" />
        </button>

        <div className="flex-1" />

        {/* Lock icon */}
        {notePassword && (
          <div className="w-7 h-7 rounded-full bg-violet-50 border border-violet-100 flex items-center justify-center">
            <Lock className="w-3 h-3 text-[#7C3AED]" />
          </div>
        )}

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

        {/* ⋯ context trigger */}
        <button onClick={() => setShowContext(true)} aria-label="More options"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <MoreHorizontal className="w-4 h-4 text-[#374151]" />
        </button>

      </header>

      {/* ── SCROLLABLE CONTENT ── */}
      <main className="flex-1 px-5 pb-56 overflow-y-auto">
        {/* Date metadata */}
        <div className="flex items-center gap-2 mt-2 mb-3">
          <span className="text-[10px] text-gray-400">{fmtDate(note.updatedAt)}</span>
        </div>

        {/* Large editable title */}
        <div
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="false"
          aria-label="Space title"
          data-placeholder="Title"
          className="clipo-title text-[1.75rem] font-black text-[#111827] leading-tight mb-4 min-h-[2.2rem] break-words"
          onInput={() => scheduleAutoSave()}
        />

        {/* Rich text body */}
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Space content"
          data-placeholder="Start writing…"
          className="clipo-richtext text-[15px] text-[#374151] leading-relaxed min-h-[80px] break-words"
          onInput={() => scheduleAutoSave()}
        />

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-col gap-3 mt-5">
            {attachments.map((att, idx) => (
              <div key={att.id} className="relative group">
                {/* Reorder + delete controls */}
                <div className="absolute -top-2 right-0 z-10 flex items-center gap-1">
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

                {/* Voice — dark pill */}
                {att.type === 'voice' && (
                  <button onClick={() => toggleAudio(att)}
                    aria-label={playingId === att.id ? 'Pause voice note' : 'Play voice note'}
                    className="w-full bg-[#111827] rounded-2xl px-4 py-3.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shrink-0">
                      {playingId === att.id
                        ? <Pause className="w-3.5 h-3.5 fill-[#111827] text-[#111827]" />
                        : <Play  className="w-3.5 h-3.5 fill-[#111827] text-[#111827] translate-x-0.5" />}
                    </div>
                    <WaveformBars waveform={att.waveform ?? Array(30).fill(40)} playing={playingId === att.id} />
                    <span className="text-white/80 text-xs font-medium shrink-0">{fmtDuration(att.duration ?? 0)}</span>
                  </button>
                )}

                {/* Image */}
                {att.type === 'image' && (
                  <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                    <img src={att.content} alt={att.fileName || 'Image'} className="w-full object-cover max-h-72" />
                    {att.fileName && (
                      <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                        <span className="text-xs text-gray-500 truncate">{att.fileName}</span>
                        <a href={att.content} download={att.fileName} aria-label="Download image"
                          className="w-6 h-6 flex items-center justify-center text-gray-400">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Video */}
                {att.type === 'video' && (
                  <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                    <video src={att.content} controls className="w-full max-h-64 bg-black" />
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
                      <FileText className="w-5 h-5 text-[#111827]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111827] truncate">{att.fileName || 'File'}</p>
                      {att.fileSize && <p className="text-xs text-gray-400">{att.fileSize}</p>}
                    </div>
                    <Download className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                )}

                {/* Link */}
                {att.type === 'link' && (
                  <a href={att.content} target="_blank" rel="noopener noreferrer"
                    className="block bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-[#111827]/40 transition-all shadow-sm">
                    {att.linkImage && <img src={att.linkImage} alt="" className="w-full h-32 object-cover" />}
                    <div className="p-3.5">
                      <p className="text-sm font-bold text-[#111827] line-clamp-1">{att.linkTitle || att.content}</p>
                      {att.linkDescription && (
                        <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{att.linkDescription}</p>
                      )}
                      <p className="text-[10px] text-[#111827] mt-1.5 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {att.content.slice(0, 42)}
                      </p>
                    </div>
                  </a>
                )}

                {/* Checklist */}
                {att.type === 'checklist' && (
                  <ChecklistBlock
                    att={att}
                    onToggle={toggleCheckItem}
                    onAddItem={addCheckItem}
                    onDeleteItem={deleteCheckItem}
                  />
                )}

                {/* Code */}
                {att.type === 'code' && (
                  <div className="bg-[#1E1E2E] rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-4 py-2 bg-white/5 flex items-center justify-between">
                      <span className="text-xs font-mono text-white/40">{att.codeLanguage || 'code'}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(att.content); showToast('Copied!', 'success'); }}
                        aria-label="Copy code"
                        className="text-xs text-white/40 hover:text-white/80 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <textarea
                      value={att.content}
                      onChange={e => {
                        const updated = attachments.map(a => a.id === att.id ? { ...a, content: e.target.value } : a);
                        setAttachments(updated);
                        scheduleAutoSave(updated);
                      }}
                      spellCheck={false}
                      aria-label="Code editor"
                      className="w-full bg-transparent text-xs font-mono text-[#A9B1D6] p-4 resize-none outline-none min-h-[100px] leading-relaxed"
                      style={{ caretColor: '#A9B1D6' }}
                    />
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── BOTTOM TOOLBAR ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20">

        {/* Sub-options panel — slides up when a tab is active */}
        <AnimatePresence>
          {activeTab && (
            <motion.div
              key={activeTab}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t border-gray-100 bg-[#FAFAFA]"
            >
              {/* ── MEDIA sub-options ── */}
              {activeTab === 'media' && (
                <div className="flex items-center gap-2 px-4 py-3">
                  {[
                    { icon: <ImageIcon className="w-5 h-5" />,  label: 'Image',  bg: 'bg-blue-50 text-blue-600',    action: () => triggerFile('image') },
                    { icon: <VideoIcon className="w-5 h-5" />,  label: 'Video',  bg: 'bg-purple-50 text-purple-600',action: () => triggerFile('video') },
                    { icon: <FileText className="w-5 h-5" />,   label: 'File',   bg: 'bg-amber-50 text-amber-600',  action: () => triggerFile('file') },
                    { icon: <Mic className="w-5 h-5" />,        label: 'Voice',  bg: 'bg-rose-50 text-rose-600',    action: () => { setShowVoice(true); setActiveTab(null); } },
                    { icon: <LinkIcon className="w-5 h-5" />,   label: 'Link',   bg: 'bg-cyan-50 text-cyan-600',    action: () => { setLinkInput(''); setShowLinkSheet(true); setActiveTab(null); } },
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

              {/* ── LIST sub-options ── */}
              {activeTab === 'list' && (
                <div className="flex items-center gap-2 px-4 py-3">
                  {[
                    { icon: <ListChecks className="w-5 h-5" />, label: 'Checklist', bg: 'bg-indigo-50 text-indigo-600',
                      action: () => { addAttachment({ id: uid(), type: 'checklist', content: '', checklistItems: [] }); }},
                    { icon: <Hash className="w-5 h-5" />, label: 'Section', bg: 'bg-emerald-50 text-emerald-600',
                      action: () => {
                        // Add section header to last checklist, or create new checklist with section
                        const lastChecklist = [...attachments].reverse().find(a => a.type === 'checklist');
                        if (lastChecklist) {
                          addCheckItem(lastChecklist.id, 'Section', true);
                          setActiveTab(null);
                        } else {
                          addAttachment({ id: uid(), type: 'checklist', content: '', checklistItems: [{ id: uid(), text: 'Section', completed: false, isSection: true }] });
                        }
                      }},
                  ].map(opt => (
                    <button key={opt.label} onClick={opt.action} aria-label={opt.label}
                      className="flex-1 flex flex-col items-center gap-1.5 py-1.5 max-w-[100px]">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${opt.bg}`}>
                        {opt.icon}
                      </div>
                      <span className="text-[10px] font-semibold text-[#374151]">{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ── FORMAT sub-options ── */}
              {activeTab === 'format' && (
                <div className="px-4 pt-3 pb-2 flex flex-col gap-3">
                  {/* Highlight colors */}
                  <div className="flex items-center gap-2.5">
                    <Highlighter className="w-4 h-4 text-gray-400 shrink-0" />
                    {[
                      { bg: '#FEF08A', label: 'Yellow' }, { bg: '#EDE9FE', label: 'Purple' },
                      { bg: '#DCFCE7', label: 'Green' },  { bg: '#FED7AA', label: 'Orange' },
                      { bg: '#FCE7F3', label: 'Pink' },
                    ].map(h => (
                      <button key={h.label} onMouseDown={e => { e.preventDefault(); bodyRef.current?.focus(); document.execCommand('backColor', false, h.bg); }}
                        aria-label={`Highlight ${h.label}`}
                        className="w-7 h-7 rounded-full border-[1.5px] border-white shadow-sm flex-shrink-0"
                        style={{ backgroundColor: h.bg }} />
                    ))}
                    <button onMouseDown={e => { e.preventDefault(); bodyRef.current?.focus(); document.execCommand('backColor', false, 'transparent'); }}
                      aria-label="Clear highlight"
                      className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center bg-white shrink-0">
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>

                  {/* Style + Headings in one row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { icon: <Bold className="w-4 h-4" />,           cmd: 'bold',               label: 'Bold' },
                      { icon: <Italic className="w-4 h-4" />,         cmd: 'italic',             label: 'Italic' },
                      { icon: <Underline className="w-4 h-4" />,      cmd: 'underline',          label: 'Underline' },
                      { icon: <Strikethrough className="w-4 h-4" />,  cmd: 'strikeThrough',      label: 'Strikethrough' },
                      { icon: <ListOrdered className="w-4 h-4" />,    cmd: 'insertOrderedList',  label: 'Numbered' },
                      { icon: <List className="w-4 h-4" />,           cmd: 'insertUnorderedList',label: 'Bullet' },
                    ].map(f => (
                      <button key={f.cmd} onMouseDown={e => { e.preventDefault(); execFormat(f.cmd); }} aria-label={f.label}
                        className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-[#374151] hover:bg-gray-50 active:bg-[#111827] active:text-white transition-colors">
                        {f.icon}
                      </button>
                    ))}

                    <div className="w-px h-6 bg-gray-200 mx-0.5 shrink-0" />

                    {[
                      { icon: <Heading1 className="w-4 h-4" />, cmd: 'formatBlock', val: 'h1', label: 'H1' },
                      { icon: <Heading2 className="w-4 h-4" />, cmd: 'formatBlock', val: 'h2', label: 'H2' },
                      { icon: <Heading3 className="w-4 h-4" />, cmd: 'formatBlock', val: 'h3', label: 'H3' },
                      { icon: <Indent className="w-4 h-4" />,   cmd: 'indent',                  label: 'Indent' },
                      { icon: <Outdent className="w-4 h-4" />,  cmd: 'outdent',                 label: 'Outdent' },
                    ].map(f => (
                      <button key={f.label} onMouseDown={e => { e.preventDefault(); execFormat(f.cmd, f.val); }} aria-label={f.label}
                        className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-[#374151] hover:bg-gray-50 active:bg-[#111827] active:text-white transition-colors">
                        {f.icon}
                      </button>
                    ))}
                  </div>

                  {/* Alignment */}
                  <div className="flex items-center gap-1.5 pb-1">
                    {[
                      { icon: <AlignLeft className="w-4 h-4" />,    cmd: 'justifyLeft',   label: 'Left' },
                      { icon: <AlignCenter className="w-4 h-4" />,  cmd: 'justifyCenter', label: 'Center' },
                      { icon: <AlignRight className="w-4 h-4" />,   cmd: 'justifyRight',  label: 'Right' },
                      { icon: <AlignJustify className="w-4 h-4" />, cmd: 'justifyFull',   label: 'Justify' },
                    ].map(f => (
                      <button key={f.cmd} onMouseDown={e => { e.preventDefault(); execFormat(f.cmd); }} aria-label={f.label}
                        className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-[#374151] hover:bg-gray-50 active:bg-[#111827] active:text-white transition-colors">
                        {f.icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── CODE sub-options ── */}
              {activeTab === 'code' && (
                <div className="px-4 py-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Language</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {['javascript','typescript','python','css','html','json','bash','other'].map(lang => (
                      <button key={lang} onClick={() => setCodeLang(lang)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                          codeLang === lang
                            ? 'bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white border-transparent'
                            : 'bg-white text-[#374151] border-gray-200 hover:border-gray-400'
                        }`}>
                        {lang}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => addAttachment({ id: uid(), type: 'code', content: '// Your code here\n', codeLanguage: codeLang })}
                    className="w-full py-2.5 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white text-sm font-bold rounded-xl mb-1">
                    Insert {codeLang} block
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main toolbar tabs */}
        <div className="flex items-stretch border-t border-gray-100">
          {[
            { id: 'media'  as ToolTab, icon: <Plus className="w-5 h-5" />,        label: 'Media' },
            { id: 'list'   as ToolTab, icon: <ListChecks className="w-5 h-5" />,  label: 'List' },
            { id: null,                icon: <PenLine className="w-5 h-5" />,      label: 'Draw', draw: true },
            { id: 'format' as ToolTab, icon: <Type className="w-5 h-5" />,         label: 'Format' },
            { id: 'code'   as ToolTab, icon: <Code className="w-5 h-5" />,         label: 'Code' },
          ].map(item => {
            const isActive = !item.draw && activeTab === item.id;
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (item.draw) { setShowDrawing(true); setActiveTab(null); return; }
                  setActiveTab(prev => prev === item.id ? null : (item.id as ToolTab));
                }}
                aria-label={item.label}
                aria-pressed={isActive}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${
                  isActive ? 'text-[#111827] bg-gray-50' : 'text-[#6B7280] hover:text-[#374151]'
                }`}
              >
                {item.icon}
                <span className="text-[9px] font-semibold">{item.label}</span>
                {isActive && <span className="w-1 h-1 rounded-full bg-[#111827] mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept={ALLOWED_TYPES.image.join(',')} className="hidden"
        onChange={e => handleFileSelected('image', e.target.files?.[0])} aria-label="Image file input" />
      <input ref={videoInputRef} type="file" accept={ALLOWED_TYPES.video.join(',')} className="hidden"
        onChange={e => handleFileSelected('video', e.target.files?.[0])} aria-label="Video file input" />
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv" className="hidden"
        onChange={e => handleFileSelected('file', e.target.files?.[0])} aria-label="Document file input" />

      {/* ═══════════════════ SHEETS ═══════════════════ */}

      {/* Context menu */}
      <Sheet open={showContext} onClose={() => setShowContext(false)}>
        <div className="px-4 pt-4 pb-2">
          <button onClick={shareLink}
            className="w-full flex items-center gap-3.5 py-3.5 text-left">
            <Share2 className="w-4 h-4 text-[#374151] shrink-0" />
            <span className="flex-1 text-sm font-medium text-[#111827]">Share Link</span>
          </button>

          <button onClick={handleDelete}
            className="w-full flex items-center gap-3.5 py-3.5 border-t border-gray-50">
            <Trash2 className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-red-500 flex-1 text-left">Delete Space</span>
          </button>

          <p className="text-[10px] text-gray-300 text-center py-3 border-t border-gray-50 mt-1">
            Last edited {fmtDate(note.updatedAt)}
          </p>
        </div>
      </Sheet>

      {/* Voice recorder */}
      <Sheet open={showVoice} onClose={() => setShowVoice(false)} title="Voice Note">
        <VoiceRecorder
          onSave={(url, dur, wf) => addAttachment({ id: uid(), type: 'voice', content: url, duration: dur, waveform: wf })}
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
            onKeyDown={e => {
              if (e.key === 'Enter' && linkInput.trim()) {
                addAttachment({ id: uid(), type: 'link', content: linkInput.trim(), linkTitle: linkInput.trim() });
                setShowLinkSheet(false);
              }
            }}
            placeholder="https://..."
            autoFocus
            className="w-full bg-[#F9FAFB] border border-gray-200 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10"
          />
          <button
            onClick={() => {
              if (!linkInput.trim()) return;
              addAttachment({ id: uid(), type: 'link', content: linkInput.trim(), linkTitle: linkInput.trim() });
              setShowLinkSheet(false);
            }}
            disabled={!linkInput.trim()}
            className="w-full py-3.5 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white font-bold rounded-2xl text-sm disabled:opacity-40"
          >
            Add Link
          </button>
        </div>
      </Sheet>

      {/* Exit warning modal */}
      <AnimatePresence>
        {showExitWarn && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowExitWarn(false)}
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
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
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-[#374151]">
                  Wait
                </button>
                <button onClick={() => { setShowExitWarn(false); doSaveAndBack(); }}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white text-sm font-bold">
                  Leave
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Drawing canvas — full-screen slide-up */}
      <AnimatePresence>
        {showDrawing && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-50"
          >
            <DrawingCanvas
              onClose={() => setShowDrawing(false)}
              onSave={dataUrl => {
                addAttachment({ id: uid(), type: 'image', content: dataUrl, fileName: 'Drawing' });
                setShowDrawing(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotePage;
