import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { createAnonymousNote } from '../contexts/NoteContext';

// ── Guest welcome drawer ──────────────────────────────────────────────────────
const GuestWelcomeDrawer: React.FC<{ onEnter: () => void }> = ({ onEnter }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-5">
    <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onEnter} />
    <motion.div
      initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-8 flex flex-col items-center gap-5 z-10 shadow-2xl"
    >
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shadow-lg">
        <span className="text-white font-black text-2xl leading-none">C</span>
      </div>
      <div className="text-center">
        <h2 className="text-xl font-black text-[#111827] mb-1.5">Welcome to Clipo! 👋</h2>
        <p className="text-sm text-[#6B7280] leading-relaxed max-w-[260px]">
          Your space is ready. Share the link — anyone can join instantly, no account needed.
        </p>
      </div>
      <div className="w-full flex flex-col gap-2">
        {[
          { icon: '⚡', text: 'Real-time sync across all devices' },
          { icon: '✍️', text: 'Rich text, checklists & voice notes' },
          { icon: '📁', text: 'Images, videos & file attachments' },
          { icon: '🔒', text: 'Optional password protection' },
        ].map(f => (
          <div key={f.text} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
            <span className="text-sm">{f.icon}</span>
            <span className="text-xs font-semibold text-[#374151]">{f.text}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#9CA3AF] -mt-1 text-center">Sign in anytime to save your spaces permanently</p>
      <button onClick={onEnter}
        className="w-full py-4 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white font-bold rounded-2xl text-sm shadow-lg hover:opacity-90 transition-all">
        Enter My Space →
      </button>
    </motion.div>
  </div>
);

// ── SignInPage ────────────────────────────────────────────────────────────────
const SignInPage: React.FC<{ onGuest: (noteId: string) => void }> = ({ onGuest }) => {
  const { signInWithGoogle } = useAuth();

  // Google
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError]     = useState('');

  // Quick link
  const [generating, setGenerating]       = useState(false);
  const [noteId, setNoteId]               = useState('');
  const [shareUrl, setShareUrl]           = useState('');
  const [linkCopied, setLinkCopied]       = useState(false);
  const [ready, setReady]                 = useState(false);

  // Password
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [passCopied, setPassCopied]       = useState(false);

  // Welcome drawer
  const [showWelcome, setShowWelcome]     = useState(false);

  const genPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handlePasswordToggle = () => {
    if (!passwordEnabled) { setPasswordEnabled(true); setPassword(genPassword()); }
    else { setPasswordEnabled(false); setPassword(''); setShowPassword(false); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const id = await createAnonymousNote(passwordEnabled ? password : undefined);
      const url = `${window.location.origin}${window.location.pathname}?share=${id}`;
      setNoteId(id);
      setShareUrl(url);
      setReady(true);
    } catch {
      setGoogleError('Failed to create link. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* clipboard denied — no false feedback */ }
  };

  const handleCopyPass = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setPassCopied(true);
      setTimeout(() => setPassCopied(false), 2000);
    } catch { /* clipboard denied — no false feedback */ }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setGoogleError('');
    try {
      await signInWithGoogle();
    } catch (e: any) {
      if (e?.code !== 'auth/popup-closed-by-user') setGoogleError('Sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleReset = () => {
    setReady(false);
    setNoteId('');
    setShareUrl('');
    setLinkCopied(false);
    setPasswordEnabled(false);
    setPassword('');
    setShowPassword(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: 'radial-gradient(circle, #9CA3AF 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute -bottom-48 -right-32 w-[420px] h-[420px] rounded-full bg-indigo-900/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F5]/60 via-transparent to-[#FAF9F5]/80" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo + title */}
        <div className="text-center mb-8">
          <motion.div
            className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shadow-soft-xl"
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, type: 'spring', damping: 18, stiffness: 280 }}
          >
            <span className="text-white font-black text-3xl leading-none">C</span>
          </motion.div>
          <motion.h1 className="text-4xl font-black text-[#111827] tracking-tight leading-none mb-1.5"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
            Clipo
          </motion.h1>
          <motion.p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7280]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}>
            Instant Collaborative Spaces
          </motion.p>
        </div>

        {/* Description */}
        <motion.p className="text-sm text-[#6B7280] leading-relaxed mb-7 text-center max-w-xs mx-auto"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}>
          Create a shared space instantly. Notes, checklists, voice memos, files.{' '}
          <span className="text-[#111827] font-semibold">No login required for collaborators.</span>
        </motion.p>

        {/* Google sign-in */}
        <motion.button
          onClick={handleGoogle} disabled={googleLoading}
          className="w-full h-14 bg-white border border-gray-200 rounded-2xl shadow-soft flex items-center justify-center gap-3 text-sm font-semibold text-[#111827] hover:bg-gray-50 hover:shadow-md transition-all disabled:opacity-60"
          whileTap={{ scale: googleLoading ? 1 : 0.98 }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
        >
          {googleLoading
            ? <svg className="animate-spin h-5 w-5 text-[#6B7280]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            : <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
          }
          {googleLoading ? 'Signing in…' : 'Continue with Google'}
        </motion.button>

        {googleError && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mt-2 text-xs text-red-500 font-medium text-center">
            {googleError}
          </motion.p>
        )}

        {/* Divider */}
        <motion.div className="flex items-center gap-3 my-5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[11px] font-semibold text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </motion.div>

        {/* Quick link section — switches between generate & ready */}
        <AnimatePresence mode="wait">

          {/* ── Generate button + password toggle ── */}
          {!ready && (
            <motion.div key="generate"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-3"
            >
              <motion.button
                onClick={handleGenerate} disabled={generating}
                className="w-full h-14 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white rounded-2xl shadow-soft-xl flex items-center justify-center gap-2.5 text-sm font-bold disabled:opacity-70 hover:opacity-90 transition-all"
                whileTap={{ scale: generating ? 1 : 0.98 }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating your space…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Generate Quick Link
                  </>
                )}
              </motion.button>

              {/* Password toggle — below the button */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                className="flex flex-col gap-2">
                <button onClick={handlePasswordToggle} type="button"
                  className="flex items-center justify-center gap-2.5 mx-auto text-xs text-[#6B7280] hover:text-[#111827] transition-colors select-none">
                  <span className={`relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 ${passwordEnabled ? 'bg-gradient-to-r from-[#111827] to-[#7C3AED]' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${passwordEnabled ? 'translate-x-4' : ''}`} />
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
                        <button type="button" onClick={() => setPassword(genPassword())}
                          className="text-[10px] font-bold text-[#111827] hover:text-[#374151] shrink-0">New</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Feature pills */}
              <motion.div className="flex flex-wrap items-center justify-center gap-2 mt-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.44 }}>
                {['Real-time sync', 'Rich media', 'Voice notes', 'Password protect'].map(f => (
                  <span key={f} className="text-[10px] font-semibold text-[#6B7280] bg-white/80 border border-[#F1ECE4] rounded-full px-3 py-1 shadow-sm">{f}</span>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* ── Link ready: card + open space ── */}
          {ready && (
            <motion.div key="ready"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-3"
            >
              {/* Link card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-soft">
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">Your Clipo Link</p>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-mono text-[#374151] flex-1 truncate bg-[#F8F9FB] px-3 py-2 rounded-xl border border-gray-100">
                    {shareUrl}
                  </p>
                  <button onClick={handleCopyLink}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      linkCopied
                        ? 'bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white'
                        : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                    }`}>
                    {linkCopied
                      ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>
                      : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                    }
                  </button>
                </div>

                {/* Password inline — no toast */}
                {passwordEnabled && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                    <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="flex-1 font-mono text-xs text-amber-800 tracking-wider select-all">
                      {showPassword ? password : '••••••••••'}
                    </span>
                    <button onClick={() => setShowPassword(p => !p)} className="text-amber-400 hover:text-amber-600">
                      {showPassword
                        ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      }
                    </button>
                    <button onClick={handleCopyPass}
                      className={`text-[10px] font-bold shrink-0 transition-colors ${passCopied ? 'text-green-600' : 'text-amber-700 hover:text-amber-900'}`}>
                      {passCopied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>

              <button onClick={() => setShowWelcome(true)}
                className="w-full h-14 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white rounded-2xl shadow-soft-xl flex items-center justify-center gap-2.5 text-sm font-bold hover:opacity-90 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Open Space
              </button>

              <button onClick={handleReset}
                className="flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#6B7280] mx-auto transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
                Create another link
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <motion.div className="relative z-10 mt-10 flex items-center justify-center gap-3 text-[10px] text-[#9CA3AF]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <a href="/privacy" className="hover:text-[#6B7280] transition-colors">Privacy Policy</a>
        <span>·</span>
        <span>Made with ♥ by Ravi</span>
      </motion.div>

      {/* Guest welcome drawer */}
      <AnimatePresence>
        {showWelcome && (
          <GuestWelcomeDrawer onEnter={() => {
            localStorage.setItem('clipo_welcomed_guest', '1');
            onGuest(noteId);
          }} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SignInPage;
