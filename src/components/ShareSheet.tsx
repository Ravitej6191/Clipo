import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, Check, UserPlus, Crown, Eye, Edit3, Trash2, ChevronDown } from 'lucide-react';
import { useNotes } from '../contexts/NoteContext';
import { useUI } from '../contexts/UIContext';
import type { ClipoNote, CollaboratorRole } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  note: ClipoNote;
  isOwner: boolean;
}

// ── Role picker dropdown ──────────────────────────────────────────────────────
const ROLES: CollaboratorRole[] = ['editor', 'viewer'];
const ROLE_META: Record<CollaboratorRole, { label: string; icon: React.ReactNode; color: string }> = {
  editor: { label: 'Editor', icon: <Edit3 className="w-3 h-3" />, color: 'text-violet-700 bg-violet-50 border-violet-200' },
  viewer: { label: 'Viewer', icon: <Eye className="w-3 h-3" />,    color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

const RolePicker: React.FC<{
  value: CollaboratorRole;
  onChange: (r: CollaboratorRole) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}> = ({ value, onChange, disabled, size = 'md' }) => {
  const [open, setOpen] = useState(false);
  const meta = ROLE_META[value];
  const pad  = size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs';

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => !disabled && setOpen(p => !p)}
        disabled={disabled}
        className={`flex items-center gap-1 ${pad} rounded-lg border font-semibold transition-colors ${meta.color} ${
          disabled ? 'opacity-50 cursor-default' : 'hover:opacity-80 cursor-pointer'
        }`}
      >
        {meta.icon}
        {meta.label}
        {!disabled && <ChevronDown className="w-3 h-3 opacity-60" />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 top-[calc(100%+4px)] z-[61] w-32 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden"
            >
              {ROLES.map(r => {
                const m = ROLE_META[r];
                return (
                  <button key={r} type="button"
                    onClick={() => { onChange(r); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
                      r === value ? `${m.color} border-0` : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {m.icon}
                    {m.label}
                    {r === value && <Check className="w-3 h-3 ml-auto" />}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── ShareSheet ────────────────────────────────────────────────────────────────
const ShareSheet: React.FC<Props> = ({ open, onClose, note, isOwner }) => {
  const { addCollaborator, removeCollaborator, updateCollaboratorRole } = useNotes();
  const { showToast } = useUI();

  const [email, setEmail]           = useState('');
  const [role, setRole]             = useState<CollaboratorRole>('editor');
  const [adding, setAdding]         = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const shareUrl = `${window.location.origin}${window.location.pathname}?share=${note.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      showToast(shareUrl, 'info');
    }
  };

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showToast('Enter a valid email address.', 'error'); return;
    }
    if ((note.collaborators ?? []).some(c => c.email.toLowerCase() === trimmed)) {
      showToast('This person already has access.', 'error'); return;
    }
    setAdding(true);
    try {
      await addCollaborator(note.id, trimmed, role);
      setEmail('');
      showToast(`Invited ${trimmed}`, 'success');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('No Clipo account')) {
        showToast('That person needs to sign in to Clipo first.', 'error');
      } else if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        showToast('Permission denied — make sure the rules are deployed.', 'error');
      } else {
        showToast(msg || 'Failed to add collaborator.', 'error');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (uid: string, label: string) => {
    try {
      await removeCollaborator(note.id, uid);
      showToast(`${label} removed.`, 'success');
    } catch {
      showToast('Failed to remove.', 'error');
    }
  };

  const handleRoleChange = async (uid: string, newRole: CollaboratorRole) => {
    try {
      await updateCollaboratorRole(note.id, uid, newRole);
    } catch {
      showToast('Failed to update role.', 'error');
    }
  };

  const collabs = note.collaborators ?? [];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 shrink-0">
              <div className="w-9 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-3.5 shrink-0">
              <h2 className="text-[15px] font-bold text-[#111827]">Share Space</h2>
              <button onClick={onClose} aria-label="Close"
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-100 shrink-0 mx-5" />

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-5 pt-4 pb-8 space-y-6">

              {/* ── Link section ── */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">Share Link</p>
                <div className="flex items-center gap-2.5 bg-[#F8F9FB] border border-gray-200 rounded-2xl px-4 py-3">
                  <Link2 className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="flex-1 text-[12px] font-mono text-[#6B7280] truncate">{shareUrl}</span>
                  <button
                    onClick={handleCopyLink}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                      linkCopied
                        ? 'bg-green-500 text-white'
                        : 'bg-[#111827] text-white hover:opacity-90'
                    }`}
                  >
                    {linkCopied
                      ? <><Check className="w-3 h-3" />Copied</>
                      : 'Copy'
                    }
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Anyone with this link who has signed in can view this space.
                </p>
              </div>

              {/* ── Invite section (owner only) ── */}
              {isOwner && (
                <div className="space-y-2.5">
                  <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">Invite People</p>

                  {/* Single contained invite row */}
                  <div className="flex items-center gap-2 bg-[#F8F9FB] border border-gray-200 rounded-2xl px-3 py-2.5 focus-within:border-[#7C3AED] focus-within:ring-2 focus-within:ring-[#7C3AED]/10 transition-all">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleInvite()}
                      placeholder="Email address"
                      className="flex-1 bg-transparent text-sm text-[#111827] placeholder:text-gray-400 outline-none min-w-0"
                    />
                    <RolePicker value={role} onChange={setRole} size="sm" />
                    <button
                      type="button"
                      onClick={handleInvite}
                      disabled={!email.trim() || adding}
                      className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white disabled:opacity-40 transition-opacity shrink-0"
                    >
                      {adding
                        ? <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        : <UserPlus className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* ── People with access ── */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">
                  People with Access
                </p>

                {/* Owner row */}
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shrink-0">
                    <Crown className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#111827]">{isOwner ? 'You' : 'Owner'}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#9CA3AF] shrink-0">Owner</span>
                </div>

                {/* Collaborator rows */}
                {collabs.map(c => {
                  const initials = (c.name?.[0] ?? c.email[0]).toUpperCase();
                  const label    = c.name ?? c.email;
                  return (
                    <div key={c.uid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                      {c.photoURL
                        ? <img src={c.photoURL} alt={label} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center shrink-0">
                            <span className="text-white text-xs font-bold">{initials}</span>
                          </div>
                        )
                      }
                      <div className="flex-1 min-w-0">
                        {c.name && <p className="text-[13px] font-semibold text-[#111827] truncate">{c.name}</p>}
                        <p className="text-[11px] text-gray-400 truncate">{c.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <RolePicker
                          value={c.role}
                          onChange={newRole => handleRoleChange(c.uid, newRole)}
                          disabled={!isOwner}
                          size="sm"
                        />
                        {isOwner && (
                          <button
                            onClick={() => handleRemove(c.uid, label)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {collabs.length === 0 && (
                  <p className="text-[12px] text-gray-400 text-center py-3">
                    No collaborators yet — invite someone above.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShareSheet;
