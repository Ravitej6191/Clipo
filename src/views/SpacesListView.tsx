import React, { useState } from 'react';
import { useNotes } from '../contexts/NoteContext';
import type { ClipoNote } from '../types';
import {
  Search, Plus, MoreHorizontal, Lock, Mic,
  CheckSquare, Image as ImageIcon, FileText, Link as LinkIcon, Code,
  Pin, Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Pastel colours per note id ───────────────────────────────────────────────
const PASTELS = ['#EBF3FF','#F7F0FF','#F0FDF4','#FFF7ED','#FDF2F8','#FEFCE8'];
const getPastel = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return PASTELS[Math.abs(h) % PASTELS.length];
};

// ─── Label colours ────────────────────────────────────────────────────────────
const LABEL_COLORS: Record<string, string> = {
  Work: 'bg-blue-100 text-blue-700',
  Personal: 'bg-purple-100 text-purple-700',
  Study: 'bg-green-100 text-green-700',
  Ideas: 'bg-amber-100 text-amber-700',
  Health: 'bg-rose-100 text-rose-700',
};
const getLabelColor = (label: string) =>
  LABEL_COLORS[label] ?? 'bg-gray-100 text-gray-600';

// ─── Attachment icon helpers ──────────────────────────────────────────────────
const AttIcon: React.FC<{ type: string }> = ({ type }) => {
  const cls = 'w-3 h-3 text-gray-400';
  if (type === 'image')     return <ImageIcon className={cls} />;
  if (type === 'voice')     return <Mic className={cls} />;
  if (type === 'checklist') return <CheckSquare className={cls} />;
  if (type === 'file')      return <FileText className={cls} />;
  if (type === 'link')      return <LinkIcon className={cls} />;
  if (type === 'code')      return <Code className={cls} />;
  return null;
};

// ─── Note Card ────────────────────────────────────────────────────────────────
const SpaceCard: React.FC<{
  note: ClipoNote;
  onOpen: (id: string) => void;
  tall?: boolean;
}> = ({ note, onOpen, tall = false }) => {
  const pastel = getPastel(note.id);
  const imageAtt = note.attachments?.find(a => a.type === 'image');
  const checklistAtt = note.attachments?.find(a => a.type === 'checklist');
  const attTypes = [...new Set(note.attachments?.map(a => a.type) ?? [])];

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  // Strip HTML for preview text
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');

  return (
    <motion.button
      onClick={() => onOpen(note.id)}
      whileTap={{ scale: 0.98 }}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col active:scale-[0.98] transition-all"
    >
      {/* Colour / image header */}
      {imageAtt ? (
        <img
          src={imageAtt.content}
          alt=""
          className={`w-full object-cover ${tall ? 'h-32' : 'h-16'}`}
        />
      ) : (
        <div
          className={`w-full ${tall ? 'h-10' : 'h-5'}`}
          style={{ backgroundColor: pastel }}
        />
      )}

      <div className="p-3.5 flex flex-col gap-2 flex-1">
        {/* Pinned indicator */}
        {note.isPinned && (
          <div className="flex items-center gap-1 text-[10px] text-amber-500 font-semibold">
            <Pin className="w-3 h-3" /> Pinned
          </div>
        )}

        {/* Locked */}
        {note.password ? (
          <div className="flex flex-col items-center justify-center py-4 gap-2">
            <Lock className="w-5 h-5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400">Locked</span>
          </div>
        ) : (
          <>
            <h3 className="text-sm font-bold text-[#111827] leading-snug line-clamp-2">
              {note.title || 'Untitled Space'}
            </h3>

            {/* Checklist preview */}
            {tall && checklistAtt?.checklistItems && (
              <div className="flex flex-col gap-1.5 mt-0.5">
                {checklistAtt.checklistItems.filter(i => !i.isSection).slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-[11px] text-gray-500">
                    <div className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center ${
                      item.completed ? 'bg-[#111827] border-[#111827]' : 'border-gray-300'
                    }`}>
                      {item.completed && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                    </div>
                    <span className={item.completed ? 'line-through opacity-50' : ''}>{item.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Body excerpt (non-checklist) */}
            {(!tall || !checklistAtt) && note.content && (
              <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                {stripHtml(note.content)}
              </p>
            )}
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-2">
            {note.label && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getLabelColor(note.label)}`}>
                {note.label}
              </span>
            )}
            {note.shared && !note.label && (
              <Globe className="w-3 h-3 text-[#111827]" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {attTypes.slice(0, 3).map(t => <AttIcon key={t} type={t} />)}
            <span className="text-[10px] text-gray-400 ml-1">{formatDate(note.updatedAt)}</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
};

// ─── SpacesListView ───────────────────────────────────────────────────────────
interface Props {
  onOpenNote: (id: string) => void;
  onCreateNote: () => void;
}

export const SpacesListView: React.FC<Props> = ({ onOpenNote, onCreateNote }) => {
  const { notes } = useNotes();
  const [search, setSearch] = useState('');

  const filtered = notes
    .filter(n => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const bodyText = n.content.replace(/<[^>]*>/g, '');
      return (
        n.title.toLowerCase().includes(q) ||
        bodyText.toLowerCase().includes(q) ||
        n.label?.toLowerCase().includes(q) ||
        n.attachments?.some(a => a.fileName?.toLowerCase().includes(q) || a.linkTitle?.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  // Pair notes into two columns
  const leftCol = filtered.filter((_, i) => i % 2 === 0);
  const rightCol = filtered.filter((_, i) => i % 2 === 1);

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#FAF9F5]/95 backdrop-blur pt-safe px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-4">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">C</span>
          </div>

          <h1 className="text-lg font-black text-[#111827]">My Spaces</h1>

          <button
            onClick={onCreateNote}
            aria-label="More options"
            className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm"
          >
            <MoreHorizontal className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search Spaces..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search spaces"
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-10 py-2.5 text-sm text-[#111827] placeholder:text-gray-400 outline-none focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/10 shadow-sm transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {search && (
          <p className="text-[11px] text-[#111827] font-semibold mt-2 pl-1">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} found
          </p>
        )}
      </header>

      {/* Cards */}
      <main className="flex-1 px-4 pb-28 pt-2">
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-4 text-center"
          >
            <div className="w-16 h-16 rounded-3xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111827] mb-1">
                {search ? 'No matching spaces' : 'No spaces yet'}
              </h3>
              <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed">
                {search ? 'Try a different search term' : 'Tap + to create your first collaborative space'}
              </p>
            </div>
            {!search && (
              <button
                onClick={onCreateNote}
                className="mt-2 px-6 py-2.5 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white text-sm font-semibold rounded-2xl"
              >
                Create Space
              </button>
            )}
          </motion.div>
        ) : (
          <div className="flex gap-3">
            {/* Left column */}
            <div className="flex flex-col gap-3 flex-1">
              <AnimatePresence>
                {leftCol.map((note, i) => (
                  <motion.div key={note.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <SpaceCard note={note} onOpen={onOpenNote} tall={note.attachments?.some(a => ['image','checklist'].includes(a.type))} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {/* Right column */}
            <div className="flex flex-col gap-3 flex-1 mt-5">
              <AnimatePresence>
                {rightCol.map((note, i) => (
                  <motion.div key={note.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i + 0.5) * 0.04 }}>
                    <SpaceCard note={note} onOpen={onOpenNote} tall={note.attachments?.some(a => ['image','checklist'].includes(a.type))} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      {/* FAB */}
      <motion.button
        onClick={onCreateNote}
        whileTap={{ scale: 0.95 }}
        aria-label="Create new space"
        className="fixed bottom-8 right-5 w-14 h-14 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white rounded-full shadow-xl flex items-center justify-center z-30"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </motion.button>
    </div>
  );
};

export default SpacesListView;
