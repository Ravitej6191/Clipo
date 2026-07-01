import React, { useState, useEffect, useRef } from 'react';
import { NoteProvider, useNotes } from './contexts/NoteContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import NotePage from './views/NotePage';
import SignInPage from './components/SignInPage';
import SpacesListView from './views/SpacesListView';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Loading spinner ──────────────────────────────────────────────────────────
const Loader: React.FC = () => (
  <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shadow-soft-xl">
        <span className="text-white font-black text-2xl leading-none">C</span>
      </div>
      <svg className="animate-spin h-5 w-5 text-[#7C3AED]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  </div>
);

// ─── Welcome popup ────────────────────────────────────────────────────────────
const WelcomePopup: React.FC<{ name: string; isGuest: boolean; onDismiss: () => void }> = ({ name, isGuest, onDismiss }) => {
  const features = isGuest
    ? [
        { icon: '🔗', text: 'Instant shareable link — one click' },
        { icon: '✍️', text: 'Rich text, checklists & voice notes' },
        { icon: '🎙️', text: 'Voice memos & file attachments' },
        { icon: '🔒', text: 'Optional password protection' },
        { icon: '⚡', text: 'Real-time sync across all devices' },
      ]
    : [
        { icon: '🔗', text: 'Instant shareable link — one click' },
        { icon: '✍️', text: 'Rich text, checklists & voice notes' },
        { icon: '🔒', text: 'Optional password protection' },
        { icon: '⚡', text: 'Real-time sync across all devices' },
        { icon: '📁', text: 'Images, videos, files & code blocks' },
      ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center p-0 sm:p-5">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onDismiss} />
      <motion.div
        initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-8 flex flex-col items-center gap-5 z-10 shadow-2xl"
      >
        <button onClick={onDismiss} aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shadow-lg">
          <span className="text-white font-black text-3xl leading-none">C</span>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-black text-[#111827] mb-1.5">
            {isGuest ? 'Welcome to Clipo! 👋' : `Welcome${name ? `, ${name.split(' ')[0]}` : ''}! 👋`}
          </h2>
          <p className="text-sm text-[#6B7280] leading-relaxed max-w-[260px]">
            {isGuest
              ? "You're in quick-link mode. Generate a link and share it — no sign-in needed for anyone."
              : "You're all set. Generate a shareable link and invite anyone to collaborate — no account needed for them."}
          </p>
        </div>

        <div className="w-full flex flex-col gap-2">
          {features.map(f => (
            <div key={f.text} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
              <span className="text-base">{f.icon}</span>
              <span className="text-xs font-semibold text-[#374151]">{f.text}</span>
            </div>
          ))}
        </div>

        {isGuest && (
          <p className="text-[11px] text-[#9CA3AF] text-center -mt-2">
            Sign in later to save your spaces permanently.
          </p>
        )}

        <button onClick={onDismiss}
          className="w-full py-4 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white font-bold rounded-2xl text-sm shadow-lg">
          {isGuest ? 'Generate my link →' : "Let's go →"}
        </button>
      </motion.div>
    </div>
  );
};

// ─── Guest Leave Warning ─────────────────────────────────────────────────────
const GuestLeaveWarning: React.FC<{
  noteId: string;
  onSignIn: () => void;
  onLeave: () => void;
  onStay: () => void;
}> = ({ onSignIn, onLeave, onStay }) => {
  const { signInWithGoogle } = useAuth();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      // AuthContext will update user state; NoteProvider will claim the note
      onSignIn();
    } catch {
      // user cancelled popup — stay on note
      onStay();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onStay} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="relative w-full max-w-sm bg-white rounded-t-3xl p-8 z-10 flex flex-col items-center gap-5 shadow-2xl"
      >
        <div className="w-12 h-1 bg-gray-200 rounded-full mb-1" />
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl">⚠️</div>
        <div className="text-center">
          <h2 className="text-lg font-black text-[#111827] mb-1.5">Your space will be gone forever</h2>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Connect your Google account to save this space permanently — your notes, attachments, and links all stay.
          </p>
        </div>
        <button onClick={handleSignIn}
          className="w-full h-12 flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-2xl shadow-sm text-sm font-semibold text-[#111827] hover:bg-gray-50 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Save with Google
        </button>
        <button onClick={onLeave}
          className="text-sm text-[#9CA3AF] hover:text-[#6B7280] transition-colors font-medium">
          Leave anyway — I don't mind losing it
        </button>
      </motion.div>
    </div>
  );
};

// ─── App Content ─────────────────────────────────────────────────────────────
const AppContent: React.FC = () => {
  const { createNote, updateNote } = useNotes();
  const { showToast } = useUI();
  const { user, isGuest, signOut, exitGuestMode } = useAuth();

  const [view, setView] = useState<'landing' | 'note' | 'spaces'>(() => {
    const share = new URLSearchParams(window.location.search).get('share');
    if (share?.startsWith('note-')) return 'note';
    if (user) return 'spaces';
    return 'landing';
  });
  const [noteId, setNoteId]             = useState<string | null>(null);
  const [shareUrl, setShareUrl]         = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [linkCopied, setLinkCopied]     = useState(false);
  const [linkReady, setLinkReady]       = useState(false);
  const [showWelcome, setShowWelcome]         = useState(false);
  const [showUserMenu, setShowUserMenu]       = useState(false);
  const [showGuestWarning, setShowGuestWarning] = useState(false);
  const [pendingLeave, setPendingLeave]       = useState<(() => void) | null>(null);
  const welcomeShownRef = useRef(false);
  const wasGuestRef     = useRef(isGuest);

  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Route signed-in users to spaces view as default landing
  useEffect(() => {
    if (user && view === 'landing') {
      const params = new URLSearchParams(window.location.search);
      const share = params.get('share');
      if (!share?.startsWith('note-')) setView('spaces');
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Claim anonymous note when a guest signs in with Google
  useEffect(() => {
    if (wasGuestRef.current && !isGuest && user && noteId) {
      updateNote(noteId, { userId: user.uid });
    }
    wasGuestRef.current = isGuest;
  }, [isGuest, user, noteId, updateNote]);

  // Show welcome popup the first time user lands on My Spaces after sign-in
  useEffect(() => {
    if (!user || view !== 'spaces' || welcomeShownRef.current) return;
    const key = `clipo_welcomed_${user.uid}`;
    if (!localStorage.getItem(key)) {
      const t = setTimeout(() => setShowWelcome(true), 600);
      return () => clearTimeout(t);
    }
  }, [user, view]);

  const handleDismissWelcome = () => {
    if (user) localStorage.setItem(`clipo_welcomed_${user.uid}`, '1');
    welcomeShownRef.current = true;
    setShowWelcome(false);
  };

  // On mount: if URL has ?share=, go straight to note
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const share  = params.get('share');
    if (share?.startsWith('note-')) { setNoteId(share); setView('note'); }
  }, []);

  // Browser back/forward
  useEffect(() => {
    const handler = () => {
      const params = new URLSearchParams(window.location.search);
      const share  = params.get('share');
      if (share?.startsWith('note-')) {
        setNoteId(share); setView('note');
      } else if (user) {
        setNoteId(null); setView('spaces'); setLinkReady(false);
      } else {
        setNoteId(null); setView('landing'); setLinkReady(false);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [user]);

  // Guest tab-close warning
  useEffect(() => {
    if (!isGuest || view !== 'note') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isGuest, view]);

  const generatePassword = (): string => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handlePasswordToggle = () => {
    if (!passwordEnabled) { setPasswordEnabled(true); setPassword(generatePassword()); }
    else { setPasswordEnabled(false); setPassword(''); }
  };

  const handleGenerate = async () => {
    if (passwordEnabled && !password.trim()) {
      showToast('Please set a password first.', 'error'); return;
    }
    setIsGenerating(true);
    try {
      const id = await createNote(
        'Untitled Space', '', [], true,
        passwordEnabled ? password.trim() : undefined,
        user?.uid,
      );
      const url = `${window.location.origin}${window.location.pathname}?share=${id}`;
      window.history.pushState({}, '', url);
      setNoteId(id); setShareUrl(url); setLinkReady(true);
    } catch {
      showToast('Failed to create space. Please try again.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      showToast(shareUrl, 'info');
    }
  };

  const handleEnterSpace = () => setView('note');

  const doBack = () => {
    window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}`);
    setNoteId(null); setShareUrl(''); setLinkReady(false);
    setPasswordEnabled(false); setPassword('');
    if (user) { setView('spaces'); } else { exitGuestMode(); setView('landing'); }
  };

  const handleBackToLanding = () => {
    if (isGuest && view === 'note') {
      // intercept: show warning
      setPendingLeave(() => doBack);
      setShowGuestWarning(true);
    } else {
      doBack();
    }
  };

  const handleSignOut = async () => {
    setShowUserMenu(false);
    if (isGuest) { exitGuestMode(); } else { await signOut(); }
    window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}`);
    setNoteId(null); setShareUrl(''); setLinkReady(false);
    setPasswordEnabled(false); setPassword(''); setView('landing');
  };

  const displayName = user?.displayName ?? (isGuest ? 'Guest' : null);
  const photoURL    = user?.photoURL ?? null;
  const initials    = displayName ? displayName[0].toUpperCase() : isGuest ? 'G' : 'C';

  return (
    <div className="min-h-screen bg-[#FAF9F5] w-full">
      <AnimatePresence mode="wait">

        {/* ── LANDING ── */}
        {view === 'landing' && (
          <motion.div key="landing" className="min-h-screen"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            {/* Grid background */}
            <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
              <div className="absolute inset-0 opacity-[0.35]"
                style={{ backgroundImage: 'radial-gradient(circle, #9CA3AF 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
              <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-400/10 blur-3xl" />
              <div className="absolute -bottom-48 -right-32 w-[420px] h-[420px] rounded-full bg-indigo-900/10 blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F5]/60 via-transparent to-[#FAF9F5]/80" />
            </div>

            {/* User avatar / sign-out — only for signed-in users, not guests */}
            {user && <div className="absolute top-4 right-4 z-20">
              <button onClick={() => setShowUserMenu(p => !p)}
                className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-md focus:outline-none">
                {photoURL
                  ? <img src={photoURL} alt={displayName ?? ''} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center text-white text-sm font-bold">
                      {initials}
                    </div>
                }
              </button>
              <AnimatePresence>
                {showUserMenu && (
                  <>
                    <motion.div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -8 }} transition={{ duration: 0.15 }}
                      className="absolute right-0 top-11 z-20 w-52 bg-white rounded-2xl shadow-soft-xl border border-gray-100 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-gray-50">
                        <p className="text-xs font-bold text-[#111827] truncate">{user?.displayName}</p>
                        <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
                      </div>
                      <button onClick={handleSignOut}
                        className="w-full text-left px-4 py-3 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors">
                        Sign out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>}

            <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative z-10">
              <motion.div className="w-full max-w-sm text-center"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Logo */}
                <motion.div
                  className="mx-auto mb-8 w-20 h-20 rounded-3xl bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shadow-soft-xl select-none"
                  initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.08, type: 'spring', damping: 18, stiffness: 280 }}
                >
                  <span className="text-white font-black text-4xl leading-none">C</span>
                </motion.div>

                <motion.h1 className="text-[2.75rem] font-black text-[#111827] tracking-tight leading-none mb-2"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
                  Clipo
                </motion.h1>
                <motion.p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7280] mb-5"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                  Instant Collaborative Spaces
                </motion.p>
                <motion.p className="text-sm text-[#6B7280] leading-relaxed mb-8 max-w-xs mx-auto"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.26 }}>
                  One link. One space. Everyone in.{' '}
                  Add notes, checklists, voice memos, images and files — then share instantly.{' '}
                  <span className="text-[#111827] font-semibold">No account needed for your collaborators.</span>
                </motion.p>

                {/* Generate button */}
                {!linkReady && (
                  <motion.button onClick={handleGenerate} disabled={isGenerating}
                    className="w-full h-14 bg-gradient-to-br from-[#111827] to-[#7C3AED] hover:opacity-90 text-white text-sm font-bold rounded-2xl shadow-soft-xl transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2.5 select-none"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
                    whileTap={{ scale: isGenerating ? 1 : 0.98 }}
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating your space…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Generate Clipo Link
                      </>
                    )}
                  </motion.button>
                )}

                {/* Password toggle */}
                {!linkReady && (
                  <motion.div className="mt-4 flex flex-col gap-3"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}>
                    <button onClick={handlePasswordToggle} type="button"
                      className="flex items-center justify-center gap-2.5 mx-auto text-xs text-[#6B7280] hover:text-[#111827] transition-colors select-none">
                      <span className={`relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 ${passwordEnabled ? 'bg-gradient-to-r from-[#111827] to-[#7C3AED]' : 'bg-gray-200'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${passwordEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                      <span className="font-medium">Protect with password</span>
                    </button>

                    <AnimatePresence>
                      {passwordEnabled && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3">
                            <svg className="w-4 h-4 text-[#9CA3AF] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span className="flex-1 font-mono text-sm text-[#111827] tracking-widest select-all">
                              {showPassword ? password : '••••••••••'}
                            </span>
                            <button type="button" onClick={() => setShowPassword(p => !p)} className="text-[#9CA3AF] hover:text-[#6B7280]">
                              {showPassword
                                ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              }
                            </button>
                            <button type="button" onClick={() => setPassword(generatePassword())}
                              className="text-[10px] font-bold text-[#111827] hover:text-[#374151] shrink-0">
                              Regenerate
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Link card */}
                <AnimatePresence>
                  {linkReady && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="mt-5 bg-white border border-gray-200 rounded-2xl p-4 text-left shadow-soft">
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">Your Clipo Link</p>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-mono text-[#374151] flex-1 truncate bg-[#F8F9FB] px-3 py-2 rounded-xl border border-gray-100">
                          {shareUrl}
                        </p>
                        <button onClick={handleCopyLink}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            linkCopied ? 'bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white' : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                          }`}>
                          {linkCopied
                            ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>
                            : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                          }
                        </button>
                      </div>

                      {passwordEnabled && password && (
                        <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] mb-3">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          <span>Password protected</span>
                          <button onClick={() => showToast(`Password: ${password}`, 'info', password)}
                            className="ml-auto text-[#111827] font-bold hover:underline">Show password</button>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <button
                          onClick={() => { window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}`); setLinkReady(false); setPasswordEnabled(false); setPassword(''); }}
                          className="flex items-center gap-1.5 text-xs font-bold text-[#374151] hover:text-[#111827] transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
                          Create another
                        </button>
                        <button onClick={handleEnterSpace}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white text-xs font-bold rounded-xl">
                          Open space
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Feature pills — signed-in mode only */}
                {!linkReady && !isGuest && (
                  <motion.div className="grid grid-cols-2 gap-2 mt-8"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.44 }}>
                    {['Real-time sync', 'Save all spaces', 'Rich media', 'Password protect'].map(f => (
                      <span key={f} className="text-[10px] font-semibold text-[#6B7280] bg-white/80 border border-[#F1ECE4] rounded-full px-3 py-1.5 shadow-sm text-center">{f}</span>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ── SPACES LIST ── */}
        {view === 'spaces' && user && (
          <motion.div key="spaces" className="min-h-screen"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}>
            <SpacesListView
              user={user}
              onSignOut={handleSignOut}
              onOpenNote={(id) => {
                window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}?share=${id}`);
                setNoteId(id); setView('note');
              }}
              onCreateNote={async () => {
                try {
                  const id = await createNote('Untitled Space', '', [], true, undefined, user.uid);
                  window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}?share=${id}`);
                  setNoteId(id); setView('note');
                } catch { showToast('Failed to create space.', 'error'); }
              }}
            />
          </motion.div>
        )}

        {/* ── NOTE EDITOR ── */}
        {view === 'note' && noteId && (
          <motion.div key={`note-${noteId}`} className="min-h-screen"
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}>
            <NotePage noteId={noteId} onBack={handleBackToLanding} />
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── WELCOME POPUP — shown after first sign-in only ── */}
      <AnimatePresence>
        {showWelcome && (
          <WelcomePopup
            name={user?.displayName ?? ''}
            isGuest={!user && isGuest}
            onDismiss={handleDismissWelcome}
          />
        )}
      </AnimatePresence>

      {/* ── GUEST LEAVE WARNING ── */}
      <AnimatePresence>
        {showGuestWarning && noteId && (
          <GuestLeaveWarning
            noteId={noteId}
            onSignIn={() => { setShowGuestWarning(false); setPendingLeave(null); }}
            onLeave={() => { setShowGuestWarning(false); pendingLeave?.(); setPendingLeave(null); }}
            onStay={() => { setShowGuestWarning(false); setPendingLeave(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Auth Gate ────────────────────────────────────────────────────────────────
const AuthGate: React.FC = () => {
  const { user, loading, isGuest, enterGuestMode } = useAuth();

  // Shared-link visitors (direct URL) bypass sign-in — auto-enter guest mode
  const hasSharedLink = !!(new URLSearchParams(window.location.search).get('share')?.startsWith('note-'));

  useEffect(() => {
    if (!loading && !user && !isGuest && hasSharedLink) {
      enterGuestMode();
    }
  }, [loading, user, isGuest, hasSharedLink, enterGuestMode]);

  if (loading || (!user && !isGuest && hasSharedLink)) return <Loader />;

  if (user || isGuest) {
    return (
      <NoteProvider userId={user?.uid}>
        <UIProvider>
          <AppContent />
        </UIProvider>
      </NoteProvider>
    );
  }

  // Guest open-space: set URL then enter guest mode so AppContent auto-navigates
  const handleGuestOpenSpace = (noteId: string) => {
    window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}?share=${noteId}`);
    enterGuestMode();
  };

  return <SignInPage onGuest={handleGuestOpenSpace} />;
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export const App: React.FC = () => (
  <AuthProvider>
    <AuthGate />
  </AuthProvider>
);

export default App;
