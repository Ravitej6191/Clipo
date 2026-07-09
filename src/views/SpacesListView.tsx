import React, { useState, useMemo } from 'react';
import { useNotes } from '../contexts/NoteContext';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import type { ClipoNote } from '../types';
import StorageSection from '../components/StorageSection';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import ShareSheet from '../components/ShareSheet';
import {
  Search, Plus, Mic,
  CheckSquare, Image as ImageIcon, FileText, Link as LinkIcon, Code,
  Pin, Trash2, X, AlertTriangle, LogOut, Shield, Users,
  Share2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Pastel colours per note id ───────────────────────────────────────────────
const PASTELS = ['#EBF3FF','#F7F0FF','#F0FDF4','#FFF7ED','#FDF2F8','#FEFCE8'];
const getPastel = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return PASTELS[Math.abs(h) % PASTELS.length];
};

const LABEL_COLORS: Record<string, string> = {
  Work: 'bg-blue-100 text-blue-700',
  Personal: 'bg-purple-100 text-purple-700',
  Study: 'bg-green-100 text-green-700',
  Ideas: 'bg-amber-100 text-amber-700',
  Health: 'bg-rose-100 text-rose-700',
};
const getLabelColor = (label: string) => LABEL_COLORS[label] ?? 'bg-gray-100 text-gray-600';

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
  onDelete: (note: ClipoNote) => void;
  onShare: (note: ClipoNote) => void;
  isOwner: boolean;
  tall?: boolean;
}> = ({ note, onOpen, onDelete, onShare, isOwner, tall = false }) => {

  const pastel       = getPastel(note.id);
  const imageAtt     = note.attachments?.find(a => a.type === 'image');
  const checklistAtt = note.attachments?.find(a => a.type === 'checklist');
  const attTypes     = [...new Set(note.attachments?.map(a => a.type) ?? [])];

  const formatDate = (iso: string) => {
    const d    = new Date(iso);
    const date = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${date}, ${time}`;
  };
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* Tappable card body */}
      <motion.button
        onClick={() => onOpen(note.id)}
        whileTap={{ scale: 0.98 }}
        className="w-full text-left flex flex-col"
      >
        {imageAtt ? (
          <img src={imageAtt.content} alt="" className={`w-full object-cover ${tall ? 'h-32' : 'h-16'}`} />
        ) : (
          <div className={`w-full ${tall ? 'h-10' : 'h-5'}`} style={{ backgroundColor: pastel }} />
        )}

        <div className="p-3.5 flex flex-col gap-2 flex-1">
          {note.isPinned && (
            <div className="flex items-center gap-1 text-[10px] text-amber-500 font-semibold">
              <Pin className="w-3 h-3" /> Pinned
            </div>
          )}

          <>
            <h3 className="text-sm font-bold text-[#111827] leading-snug line-clamp-2">
              {note.title || 'Untitled Space'}
            </h3>
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
            {(!tall || !checklistAtt) && note.content && (
              <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{stripHtml(note.content)}</p>
            )}
          </>

          <div className="flex items-center gap-1.5 mt-auto pt-1.5">
            {attTypes.slice(0, 3).map(t => <AttIcon key={t} type={t} />)}
            {note.label && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ml-auto ${getLabelColor(note.label)}`}>
                {note.label}
              </span>
            )}
          </div>
        </div>
      </motion.button>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
        <span className="text-[10px] text-gray-400">{formatDate(note.updatedAt)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); onShare(note); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#7C3AED] hover:bg-purple-50 transition-colors"
            aria-label="Share"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          {isOwner && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(note); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── NoteGrid ─────────────────────────────────────────────────────────────────
const NoteGrid: React.FC<{
  notes: ClipoNote[];
  onOpenNote: (id: string) => void;
  onDelete: (note: ClipoNote) => void;
  onShare: (note: ClipoNote) => void;
  userId: string;
  emptyTitle: string;
  emptyDesc: string;
  onCreateNote?: () => void;
}> = ({ notes, onOpenNote, onDelete, onShare, userId, emptyTitle, emptyDesc, onCreateNote }) => {
  const left  = notes.filter((_, i) => i % 2 === 0);
  const right = notes.filter((_, i) => i % 2 === 1);

  if (notes.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#111827] mb-1">{emptyTitle}</h3>
          <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed">{emptyDesc}</p>
        </div>
        {onCreateNote && (
          <button onClick={onCreateNote}
            className="mt-2 px-6 py-2.5 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white text-sm font-semibold rounded-2xl">
            Create Space
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col gap-3 flex-1">
        <AnimatePresence>
          {left.map((note, i) => (
            <motion.div key={note.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <SpaceCard note={note} onOpen={onOpenNote} onDelete={onDelete} onShare={onShare}
                isOwner={(note.ownerId ?? (note as any).userId) === userId}
                tall={note.attachments?.some(a => ['image','checklist'].includes(a.type))} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex flex-col gap-3 flex-1">
        <AnimatePresence>
          {right.map((note, i) => (
            <motion.div key={note.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i + 0.5) * 0.04 }}>
              <SpaceCard note={note} onOpen={onOpenNote} onDelete={onDelete} onShare={onShare}
                isOwner={(note.ownerId ?? (note as any).userId) === userId}
                tall={note.attachments?.some(a => ['image','checklist'].includes(a.type))} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── SpacesListView ───────────────────────────────────────────────────────────
interface Props {
  onOpenNote: (id: string) => void;
  onCreateNote: () => void;
  user: { displayName?: string | null; email?: string | null; photoURL?: string | null };
  onSignOut: () => void;
}

export const SpacesListView: React.FC<Props> = ({ onOpenNote, onCreateNote, user, onSignOut }) => {
  const { notes, sharedNotes, notesLoading, deleteNote } = useNotes();
  const { deleteAccount, user: authUser } = useAuth();
  const { showToast, showConfirm } = useUI();

  const [tab, setTab]                     = useState<'mine' | 'shared'>('mine');
  const [search, setSearch]               = useState('');
  const [showMenu, setShowMenu]           = useState(false);
  const [showPrivacy, setShowPrivacy]     = useState(false);
  const [showDeleteDrawer, setShowDeleteDrawer]   = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting]       = useState(false);
  const [shareTarget, setShareTarget]     = useState<ClipoNote | null>(null);

  const uid = authUser?.uid ?? '';

  const handleCardDelete = (note: ClipoNote) => {
    showConfirm({
      title: 'Delete Space',
      message: `"${note.title || 'Untitled Space'}" will be permanently deleted.`,
      confirmLabel: 'Delete',
      isDanger: true,
      onConfirm: () => deleteNote(note.id).catch(() => showToast('Delete failed.', 'error')),
    });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') return;
    setIsDeleting(true);
    try {
      await deleteAccount();
    } catch (e: any) {
      setIsDeleting(false);
      if (e?.code === 'auth/requires-recent-login') {
        showToast('Please sign out and sign back in, then try again.', 'error');
      } else {
        showToast('Failed to delete account. Please try again.', 'error');
      }
      setShowDeleteDrawer(false);
      setDeleteConfirmText('');
    }
  };

  const filteredMine = useMemo(() => {
    if (!search.trim()) return [...notes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    const q = search.toLowerCase();
    return notes.filter(n => {
      const bodyText = n.content.replace(/<[^>]*>/g, '');
      return (
        n.title.toLowerCase().includes(q) ||
        bodyText.toLowerCase().includes(q) ||
        n.label?.toLowerCase().includes(q) ||
        n.attachments?.some(a => a.fileName?.toLowerCase().includes(q) || a.linkTitle?.toLowerCase().includes(q))
      );
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [notes, search]);

  const filteredShared = useMemo(() => {
    if (!search.trim()) return [...sharedNotes].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const q = search.toLowerCase();
    return sharedNotes.filter(n => {
      const bodyText = n.content.replace(/<[^>]*>/g, '');
      return (
        n.title.toLowerCase().includes(q) ||
        bodyText.toLowerCase().includes(q) ||
        n.attachments?.some(a => a.fileName?.toLowerCase().includes(q))
      );
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [sharedNotes, search]);

  const displayList = tab === 'mine' ? filteredMine : filteredShared;

  const initials = (user.displayName?.[0] ?? 'C').toUpperCase();

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#FAF9F5]/95 backdrop-blur px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-4">
          {/* Avatar */}
          <div className="relative">
            <button onClick={() => setShowMenu(p => !p)} aria-label="Account"
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] shrink-0">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName ?? ''} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{initials}</span>
                </div>
              )}
            </button>

            <AnimatePresence>
              {showMenu && (
                <>
                  <motion.div className="fixed inset-0 z-[60]" onClick={() => setShowMenu(false)}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }} transition={{ duration: 0.12 }}
                    className="absolute left-0 top-12 z-[61] w-60 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
                  >
                    {/* Profile header */}
                    <div className="px-4 py-3.5 flex items-center gap-3 border-b border-gray-100">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName ?? ''} className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shrink-0">
                          <span className="text-white font-bold text-sm">{initials}</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#111827] truncate">{user.displayName ?? 'User'}</p>
                        <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>

                    {/* Storage */}
                    <StorageSection />

                    {/* Menu items */}
                    <div className="border-t border-gray-100">
                      <button onClick={() => { setShowMenu(false); setShowPrivacy(true); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold text-[#374151] hover:bg-gray-50 transition-colors">
                        <Shield className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                        Privacy Policy
                      </button>
                      <button onClick={() => { setShowMenu(false); onSignOut(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold text-[#374151] hover:bg-gray-50 transition-colors border-t border-gray-100">
                        <LogOut className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                        Sign out
                      </button>
                      <button onClick={() => { setShowMenu(false); setShowDeleteDrawer(true); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors border-t border-gray-100">
                        <Trash2 className="w-4 h-4 shrink-0" />
                        Delete Account
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <h1 className="text-lg font-black text-[#111827]">Clipo</h1>

          <button onClick={onCreateNote} aria-label="New space"
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shadow-sm">
            <Plus className="w-5 h-5 text-white stroke-[2.5]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
          <button
            onClick={() => setTab('mine')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === 'mine' ? 'bg-white text-[#111827] shadow-sm' : 'text-gray-500'
            }`}
          >
            My Spaces
            {notes.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                tab === 'mine' ? 'bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white' : 'bg-gray-200 text-gray-500'
              }`}>{notes.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('shared')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === 'shared' ? 'bg-white text-[#111827] shadow-sm' : 'text-gray-500'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Shared With Me
            {sharedNotes.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                tab === 'shared' ? 'bg-[#7C3AED] text-white' : 'bg-gray-300 text-gray-600'
              }`}>{sharedNotes.length}</span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search spaces…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search spaces"
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-10 py-2.5 text-sm text-[#111827] placeholder:text-gray-400 outline-none focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/10 shadow-sm transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {search && (
          <p className="text-[11px] text-[#111827] font-semibold mt-2 pl-1">
            {displayList.length} result{displayList.length !== 1 ? 's' : ''} found
          </p>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-28 pt-2">
        {notesLoading ? (
          <div className="flex gap-3 mt-2">
            {[0, 1].map(col => (
              <div key={col} className="flex flex-col gap-3 flex-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                    <div className="h-10 bg-gray-100" />
                    <div className="p-3.5 space-y-2">
                      <div className="h-3 bg-gray-100 rounded-full w-3/4" />
                      <div className="h-2.5 bg-gray-100 rounded-full w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
        <NoteGrid
          notes={displayList}
          onOpenNote={onOpenNote}
          onDelete={handleCardDelete}
          onShare={note => setShareTarget(note)}
          userId={uid}
          emptyTitle={tab === 'mine'
            ? (search ? 'No matching spaces' : 'No spaces yet')
            : (search ? 'No matching spaces' : 'Nothing shared with you yet')}
          emptyDesc={tab === 'mine'
            ? (search ? 'Try a different search term' : 'Tap + to create your first collaborative space')
            : (search ? 'Try a different search term' : 'When someone shares a space with you, it will appear here')}
          onCreateNote={tab === 'mine' && !search ? onCreateNote : undefined}
        />
        )}
      </main>

      <PrivacyPolicyModal open={showPrivacy} onClose={() => setShowPrivacy(false)} />

      {shareTarget && (
        <ShareSheet
          open={!!shareTarget}
          onClose={() => setShareTarget(null)}
          note={shareTarget as any}
          isOwner={(shareTarget.ownerId ?? (shareTarget as any).userId) === uid}
        />
      )}

      {/* Delete Account Drawer */}
      <AnimatePresence>
        {showDeleteDrawer && (
          <>
            <motion.div className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { if (!isDeleting) { setShowDeleteDrawer(false); setDeleteConfirmText(''); } }}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-[56] rounded-t-2xl bg-white border-t border-gray-100 p-6 pb-10 max-w-md mx-auto"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-200" />
              {!isDeleting && (
                <button onClick={() => { setShowDeleteDrawer(false); setDeleteConfirmText(''); }}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X size={16} />
                </button>
              )}

              <div className="mt-2 space-y-5">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                    <AlertTriangle size={22} className="text-red-500" />
                  </div>
                  <h2 className="text-[17px] font-bold text-[#111827]">Delete Account</h2>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed">
                    This will permanently delete your account and <strong className="text-[#111827]">all {notes.length} space{notes.length !== 1 ? 's' : ''}</strong> along with every file and attachment. This cannot be undone.
                  </p>
                </div>

                <div className="rounded-xl bg-red-50 border border-red-100 p-4 space-y-2">
                  {[
                    'Your Google account connection',
                    `All ${notes.length} space${notes.length !== 1 ? 's' : ''} and their content`,
                    'All uploaded images, videos, voice notes & files',
                    'Share links (they will stop working)',
                  ].map(item => (
                    <div key={item} className="flex items-start gap-2 text-[12px] text-red-700">
                      <span className="mt-0.5 shrink-0">✕</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-[#374151]">
                    Type <span className="font-mono font-bold text-red-600">delete</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    disabled={isDeleting}
                    placeholder="delete"
                    autoComplete="off"
                    className="w-full border border-gray-200 focus:border-red-400 focus:ring-2 focus:ring-red-100 rounded-xl px-4 py-3 text-sm text-[#111827] outline-none transition-all disabled:opacity-50"
                  />
                </div>

                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText.trim().toLowerCase() !== 'delete' || isDeleting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none text-white text-[14px] font-semibold transition-colors"
                >
                  {isDeleting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Deleting everything…
                    </>
                  ) : (
                    <><Trash2 size={15} /> Delete My Account</>
                  )}
                </button>

                {!isDeleting && (
                  <button onClick={() => { setShowDeleteDrawer(false); setDeleteConfirmText(''); }}
                    className="w-full py-2.5 text-[13px] text-[#6B7280] hover:text-[#374151] transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SpacesListView;
