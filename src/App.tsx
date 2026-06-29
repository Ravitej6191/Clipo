import React, { useState, useEffect } from 'react';
import { NoteProvider, useNotes } from './contexts/NoteContext';
import { UIProvider, useUI } from './contexts/UIContext';
import NotePage from './views/NotePage';
import { motion, AnimatePresence } from 'framer-motion';

// ─── App Content ─────────────────────────────────────────────────────────────
const AppContent: React.FC = () => {
  const { createNote } = useNotes();
  const { showToast } = useUI();

  const [view, setView]               = useState<'landing' | 'note'>('landing');
  const [noteId, setNoteId]           = useState<string | null>(null);
  const [shareUrl, setShareUrl]       = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [linkCopied, setLinkCopied]   = useState(false);
  const [linkReady, setLinkReady]     = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('clipo_welcomed')) {
      setShowWelcome(true);
    }
  }, []);

  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const generatePassword = (): string => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handlePasswordToggle = () => {
    if (!passwordEnabled) {
      setPasswordEnabled(true);
      setPassword(generatePassword());
    } else {
      setPasswordEnabled(false);
      setPassword('');
    }
  };

  // On mount: if URL has ?share=, go straight to note
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const share = params.get('share');
    if (share?.startsWith('note-')) {
      setNoteId(share);
      setView('note');
    }
  }, []);

  // Browser back/forward
  useEffect(() => {
    const handler = () => {
      const params = new URLSearchParams(window.location.search);
      const share = params.get('share');
      if (share?.startsWith('note-')) {
        setNoteId(share);
        setView('note');
      } else {
        setNoteId(null);
        setView('landing');
        setLinkReady(false);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const handleGenerate = async () => {
    if (passwordEnabled && !password.trim()) {
      showToast('Please enter a password to protect the space.', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const id = await createNote(
        'Untitled Space', '', [], true,
        passwordEnabled ? password.trim() : undefined,
      );
      const url = `${window.location.origin}${window.location.pathname}?share=${id}`;
      window.history.pushState({}, '', url);
      setNoteId(id);
      setShareUrl(url);
      setLinkReady(true);
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

  const handleBackToLanding = () => {
    window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}`);
    setNoteId(null);
    setShareUrl('');
    setLinkReady(false);
    setPasswordEnabled(false);
    setPassword('');
    setView('landing');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] w-full">
      <AnimatePresence mode="wait">

        {/* ── LANDING ── */}
        {view === 'landing' && (
          <motion.div
            key="landing"
            className="min-h-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            {/* Grid background */}
            <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
              {/* Dot grid */}
              <div className="absolute inset-0 opacity-[0.35]"
                style={{
                  backgroundImage: 'radial-gradient(circle, #9CA3AF 1px, transparent 1px)',
                  backgroundSize: '28px 28px',
                }} />
              {/* Top-left violet glow */}
              <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-400/10 blur-3xl orb-animate" />
              {/* Bottom-right dark glow */}
              <div className="absolute -bottom-48 -right-32 w-[420px] h-[420px] rounded-full bg-indigo-900/10 blur-3xl orb-animate-slow" />
              {/* Center warm tint */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full bg-purple-300/5 blur-2xl" />
              {/* Fade edges to page colour so grid doesn't feel harsh */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F5]/60 via-transparent to-[#FAF9F5]/80" />
            </div>

            <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative z-10">
              <motion.div
                className="w-full max-w-sm text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Logo */}
                <motion.div
                  className="mx-auto mb-8 w-20 h-20 rounded-3xl bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shadow-soft-xl select-none"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.08, type: 'spring', damping: 18, stiffness: 280 }}
                >
                  <span className="text-white font-black text-4xl leading-none">C</span>
                </motion.div>

                <motion.h1
                  className="text-[2.75rem] font-black text-[#111827] tracking-tight leading-none mb-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14 }}
                >
                  Clipo
                </motion.h1>
                <motion.p
                  className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7280] mb-5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  Instant Collaborative Spaces
                </motion.p>
                <motion.p
                  className="text-sm text-[#6B7280] leading-relaxed mb-8 max-w-xs mx-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.26 }}
                >
                  Create a shared space instantly. Write notes, checklists, voice memos.
                  Share the link — anyone can collaborate.{' '}
                  <span className="text-[#111827] font-semibold">No login required.</span>
                </motion.p>

                {/* Generate button — hidden once link is ready */}
                {!linkReady && (
                  <motion.button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full h-14 bg-gradient-to-br from-[#111827] to-[#7C3AED] hover:opacity-90 text-white text-sm font-bold rounded-2xl shadow-soft-xl hover:shadow-2xl transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2.5 select-none"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.32 }}
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
                  <motion.div
                    className="mt-4 flex flex-col gap-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.38 }}
                  >
                    <button
                      onClick={handlePasswordToggle}
                      className="flex items-center justify-center gap-2.5 mx-auto text-xs text-[#6B7280] hover:text-[#111827] transition-colors select-none"
                      type="button"
                    >
                      <span className={`relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 ${passwordEnabled ? 'bg-[#111827]' : 'bg-gray-200'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${passwordEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                      <span className="font-medium">Protect with password</span>
                      <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </button>

                    <AnimatePresence>
                      {passwordEnabled && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3">
                            <svg className="w-4 h-4 text-[#9CA3AF] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span className="flex-1 font-mono text-sm text-[#111827] tracking-widest select-all">
                              {showPassword ? password : '••••••••••'}
                            </span>
                            <button type="button" onClick={() => setShowPassword(p => !p)} className="text-[#9CA3AF] hover:text-[#6B7280]">
                              {showPassword ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPassword(generatePassword())}
                              className="text-[10px] font-bold text-[#111827] hover:text-[#374151] shrink-0"
                            >
                              Regenerate
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Inline link card */}
                <AnimatePresence>
                  {linkReady && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="mt-5 bg-white border border-gray-200 rounded-2xl p-4 text-left shadow-soft"
                    >
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">Your Clipo Link</p>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-mono text-[#374151] flex-1 truncate bg-[#F8F9FB] px-3 py-2 rounded-xl border border-gray-100">
                          {shareUrl}
                        </p>
                        <button
                          onClick={handleCopyLink}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            linkCopied ? 'bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white' : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                          }`}
                        >
                          {linkCopied ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>

                      {passwordEnabled && password && (
                        <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] mb-3">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          <span>Password protected</span>
                          <button
                            onClick={() => showToast(`Password: ${password}`, 'info', password)}
                            className="ml-auto text-[#111827] font-bold hover:underline"
                          >
                            Show password
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <button
                          onClick={() => {
                            window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}`);
                            setLinkReady(false);
                            setPasswordEnabled(false);
                            setPassword('');
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-[#374151] hover:text-[#111827] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                          </svg>
                          Create another
                        </button>
                        <button
                          onClick={handleEnterSpace}
                          className="flex items-center gap-1.5 text-xs font-bold text-[#374151] hover:text-[#111827] transition-colors"
                        >
                          Go to space
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Feature pills */}
                {!linkReady && (
                  <motion.div
                    className="flex flex-wrap items-center justify-center gap-2 mt-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.44 }}
                  >
                    {['Real-time sync', 'No sign-up', 'Rich media', 'Password protect'].map(f => (
                      <span key={f} className="text-[10px] font-semibold text-[#6B7280] bg-white/80 border border-[#F1ECE4] rounded-full px-3 py-1 shadow-sm">
                        {f}
                      </span>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ── NOTE EDITOR ── */}
        {view === 'note' && noteId && (
          <motion.div
            key={`note-${noteId}`}
            className="min-h-screen"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <NotePage noteId={noteId} onBack={handleBackToLanding} />
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── WELCOME POPUP ── */}
      <AnimatePresence>
        {showWelcome && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center p-0 sm:p-5">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-8 flex flex-col items-center gap-5 z-10 shadow-2xl"
            >
              {/* Dismiss */}
              <button
                onClick={() => { localStorage.setItem('clipo_welcomed', '1'); setShowWelcome(false); }}
                aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* Logo */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-3xl leading-none">C</span>
              </div>

              <div className="text-center">
                <h2 className="text-xl font-black text-[#111827] mb-1.5">Welcome to Clipo</h2>
                <p className="text-sm text-[#6B7280] leading-relaxed max-w-[260px]">
                  Generate a shareable link in seconds. Write notes, checklists, voice memos — anyone can join, no login needed.
                </p>
              </div>

              <div className="w-full flex flex-col gap-2">
                {[
                  { icon: '🔗', text: 'Instant shareable link' },
                  { icon: '✍️', text: 'Rich text, checklists & voice notes' },
                  { icon: '🔒', text: 'Optional password protection' },
                  { icon: '⚡', text: 'Real-time auto-sync' },
                ].map(f => (
                  <div key={f.text} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
                    <span className="text-base">{f.icon}</span>
                    <span className="text-xs font-semibold text-[#374151]">{f.text}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { localStorage.setItem('clipo_welcomed', '1'); setShowWelcome(false); }}
                className="w-full py-4 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white font-bold rounded-2xl text-sm shadow-lg"
              >
                Get Started
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export const App: React.FC = () => (
  <UIProvider>
    <NoteProvider>
      <AppContent />
    </NoteProvider>
  </UIProvider>
);

export default App;
