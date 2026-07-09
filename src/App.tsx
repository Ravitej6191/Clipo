import React, { useState, useEffect } from 'react';
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
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shadow-xl">
        <span className="text-white font-black text-2xl leading-none">C</span>
      </div>
      <svg className="animate-spin h-5 w-5 text-[#7C3AED]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  </div>
);

// ─── App Content (rendered only when user is signed in) ───────────────────────
const AppContent: React.FC = () => {
  const { createNote } = useNotes();
  const { showToast } = useUI();
  const { user, signOut } = useAuth();

  const [view, setView] = useState<'spaces' | 'note'>(() => {
    const share = new URLSearchParams(window.location.search).get('share');
    return share?.startsWith('note-') ? 'note' : 'spaces';
  });
  const [noteId, setNoteId] = useState<string | null>(() => {
    const share = new URLSearchParams(window.location.search).get('share');
    return share?.startsWith('note-') ? share : null;
  });

  // Redirect to spaces if auth is lost
  useEffect(() => {
    if (!user) {
      setView('spaces');
      setNoteId(null);
    }
  }, [user]);

  // Browser back/forward
  useEffect(() => {
    const handler = () => {
      const share = new URLSearchParams(window.location.search).get('share');
      if (share?.startsWith('note-')) {
        setNoteId(share); setView('note');
      } else {
        setNoteId(null); setView('spaces');
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const openNote = (id: string) => {
    window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}?share=${id}`);
    setNoteId(id);
    setView('note');
  };

  const goToSpaces = () => {
    window.history.pushState({}, '', `${window.location.origin}${window.location.pathname}`);
    setNoteId(null);
    setView('spaces');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      showToast('Sign out failed. Please try again.', 'error');
    }
  };

  const handleCreateNote = async () => {
    try {
      const id = await createNote('Untitled Space', '', []);
      openNote(id);
    } catch {
      showToast('Failed to create space. Please try again.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] w-full">
      <AnimatePresence mode="wait">

        {view === 'spaces' && user && (
          <motion.div key="spaces" className="min-h-screen"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}>
            <SpacesListView
              user={user}
              onSignOut={handleSignOut}
              onOpenNote={openNote}
              onCreateNote={handleCreateNote}
            />
          </motion.div>
        )}

        {view === 'note' && noteId && (
          <motion.div key={`note-${noteId}`} className="min-h-screen"
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}>
            <NotePage noteId={noteId} onBack={goToSpaces} onNoteDeleted={goToSpaces} />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

// ─── Auth Gate ────────────────────────────────────────────────────────────────
const AuthGate: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) return <Loader />;

  if (user) {
    return (
      <NoteProvider userId={user.uid}>
        <UIProvider>
          <AppContent />
        </UIProvider>
      </NoteProvider>
    );
  }

  return (
    <UIProvider>
      <SignInPage />
    </UIProvider>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export const App: React.FC = () => (
  <AuthProvider>
    <AuthGate />
  </AuthProvider>
);

export default App;
