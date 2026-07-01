import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ClipoNote } from '../types';
import { db } from '../services/firebase';
import { mockDb } from '../services/mockDb';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';

interface NoteContextType {
  notes: ClipoNote[];
  createNote: (
    title: string,
    content: string,
    attachments: ClipoNote['attachments'],
    isShared?: boolean,
    password?: string,
    userId?: string,
  ) => Promise<string>;
  updateNote: (id: string, updates: Partial<ClipoNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  subscribeSharedNote: (
    noteId: string,
    callback: (note: ClipoNote | null) => void,
    onError?: (err: Error) => void,
  ) => () => void;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

export const NoteProvider: React.FC<{
  children: React.ReactNode;
  userId?: string;
}> = ({ children, userId }) => {
  const [notes, setNotes] = useState<ClipoNote[]>([]);

  // ── Subscribe to the authenticated user's notes ───────────────────────────
  useEffect(() => {
    if (!db) {
      // Offline / no Firebase — use localStorage
      setNotes(mockDb.getNotes());
      const unsub = mockDb.onLocalSync((e) => {
        if (e.type === 'NOTES_UPDATED') setNotes(e.data);
      });
      return unsub;
    }

    if (!userId) {
      setNotes([]);
      return;
    }

    // Real-time Firestore listener for this user's notes
    // No orderBy to avoid composite index requirement — sorted client-side
    const q = query(
      collection(db, 'notes'),
      where('userId', '==', userId),
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClipoNote)));
    }, () => {
      // Firestore listener error (rules/network) — fall back to localStorage so
      // optimistically-added notes (from createNote) remain visible
      const local = mockDb.getNotes().filter(n => n.userId === userId);
      if (local.length > 0) setNotes(prev => prev.length === 0 ? local : prev);
    });

    return unsub;
  }, [userId]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const createNote = useCallback(async (
    title: string,
    content: string,
    attachments: ClipoNote['attachments'],
    isShared = true,
    password?: string,
    uid?: string,
  ): Promise<string> => {
    const noteId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const newNote: ClipoNote = {
      id: noteId,
      title: title || 'Untitled Space',
      content,
      attachments: attachments ?? [],
      createdAt: now,
      updatedAt: now,
      userId: uid ?? userId ?? 'anonymous',
      shared: isShared,
      ...(password ? { password } : {}),
    };

    if (db) {
      await setDoc(doc(db, 'notes', noteId), newNote);
      // Optimistically add to local state immediately — onSnapshot will confirm
      setNotes(prev => [newNote, ...prev.filter(n => n.id !== noteId)]);
    } else {
      const all = mockDb.getNotes();
      mockDb.saveNotes([newNote, ...all]);
      setNotes([newNote, ...all]);
    }

    return noteId;
  }, [userId]);

  const updateNote = useCallback(async (id: string, updates: Partial<ClipoNote>): Promise<void> => {
    const patch = { ...updates, updatedAt: new Date().toISOString() };
    if (db) {
      // Optimistically update local state so SpacesListView reflects changes immediately
      setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
      await updateDoc(doc(db, 'notes', id), patch);
    } else {
      const all = mockDb.getNotes().map((n) => n.id === id ? { ...n, ...patch } : n);
      mockDb.saveNotes(all);
      setNotes(all);
    }
  }, []);

  const deleteNote = useCallback(async (id: string): Promise<void> => {
    if (db) {
      await deleteDoc(doc(db, 'notes', id));
    } else {
      const all = mockDb.getNotes().filter((n) => n.id !== id);
      mockDb.saveNotes(all);
      setNotes(all);
    }
  }, []);

  // ── Real-time subscription to a single shared note (for collaborators) ────
  const subscribeSharedNote = useCallback((
    noteId: string,
    callback: (note: ClipoNote | null) => void,
    onError?: (err: Error) => void,
  ): () => void => {
    if (db) {
      return onSnapshot(
        doc(db, 'notes', noteId),
        (snap) => {
          if (snap.exists()) {
            callback({ id: snap.id, ...snap.data() } as ClipoNote);
          } else {
            // Doc not in Firestore — check localStorage (created offline or Firestore write failed)
            const local = mockDb.getNotes().find((n) => n.id === noteId) ?? null;
            callback(local);
          }
        },
        (err) => {
          // Firestore read error (rules, network) — try localStorage before giving up
          const local = mockDb.getNotes().find((n) => n.id === noteId) ?? null;
          if (local) { callback(local); return; }
          if (onError) onError(err);
          else callback(null);
        },
      );
    }

    // localStorage fallback (no Firebase configured)
    const tid = setTimeout(() => {
      const found = mockDb.getNotes().find((n) => n.id === noteId) ?? null;
      callback(found);
    }, 0);
    const unsub = mockDb.onLocalSync((e) => {
      if (e.type === 'NOTES_UPDATED') {
        callback((e.data as ClipoNote[]).find((n) => n.id === noteId) ?? null);
      }
    });
    return () => { clearTimeout(tid); unsub(); };
  }, []);

  return (
    <NoteContext.Provider value={{ notes, createNote, updateNote, deleteNote, subscribeSharedNote }}>
      {children}
    </NoteContext.Provider>
  );
};

export function useNotes() {
  const ctx = useContext(NoteContext);
  if (!ctx) throw new Error('useNotes must be used within NoteProvider');
  return ctx;
}

// Standalone helper — creates a note without needing NoteProvider in scope
export async function createAnonymousNote(password?: string): Promise<string> {
  const noteId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const note = {
    id: noteId,
    title: 'Untitled Space',
    content: '',
    attachments: [] as ClipoNote['attachments'],
    createdAt: now,
    updatedAt: now,
    userId: 'anonymous',
    shared: true,
    ...(password ? { password } : {}),
  };
  if (db) {
    try {
      await setDoc(doc(db, 'notes', noteId), note);
    } catch {
      // Firestore write failed — fall back to localStorage so the flow still works
      mockDb.saveNotes([note, ...mockDb.getNotes()]);
    }
  } else {
    mockDb.saveNotes([note, ...mockDb.getNotes()]);
  }
  return noteId;
}
