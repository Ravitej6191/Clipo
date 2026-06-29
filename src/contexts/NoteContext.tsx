import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ClipoNote } from '../types';
import { mockDb } from '../services/mockDb';
import { db as firestoreDb } from '../services/firebase';
import {
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

interface NoteContextType {
  notes: ClipoNote[];
  syncStatus: 'synced' | 'syncing' | 'offline';
  createNote: (
    title: string,
    content: string,
    attachments: ClipoNote['attachments'],
    isShared?: boolean,
    password?: string
  ) => Promise<string>;
  updateNote: (id: string, updates: Partial<ClipoNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  subscribeSharedNote: (
    noteId: string,
    callback: (note: ClipoNote | null) => void
  ) => () => void;
  updateSharedNote: (id: string, updates: Partial<ClipoNote>) => Promise<void>;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

export const NoteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<ClipoNote[]>([]);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');

  useEffect(() => {
    if (!firestoreDb) {
      setNotes(mockDb.getNotes());
      const remove = mockDb.onLocalSync((event) => {
        if (event.type === 'NOTES_UPDATED') setNotes(event.data);
      });
      return remove;
    }
    setSyncStatus('synced');
  }, []);

  const createNote = useCallback(async (
    title: string,
    content: string,
    attachments: ClipoNote['attachments'],
    isShared = true,
    password?: string
  ): Promise<string> => {
    const noteId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newNote: ClipoNote = {
      id: noteId,
      title: title || 'Untitled Space',
      content,
      attachments: attachments ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'anonymous',
      shared: isShared,
      ...(password ? { password } : {}),
    };

    setSyncStatus('syncing');
    try {
      if (firestoreDb) {
        await setDoc(doc(firestoreDb, 'notes', noteId), newNote);
      } else {
        // Save to localStorage immediately
        const existing = mockDb.getNotes();
        const updated = [newNote, ...existing];
        mockDb.saveNotes(updated);
        setNotes(updated);
      }
      setSyncStatus('synced');
    } catch (err) {
      console.error('[createNote]', err);
      setSyncStatus('offline');
    }
    return noteId;
  }, []);

  const updateNote = useCallback(async (id: string, updates: Partial<ClipoNote>): Promise<void> => {
    const finalUpdates = { ...updates, updatedAt: new Date().toISOString() };
    try {
      if (firestoreDb) {
        await updateDoc(doc(firestoreDb, 'notes', id), finalUpdates);
      } else {
        const updated = mockDb.getNotes().map(n => n.id === id ? { ...n, ...finalUpdates } : n);
        mockDb.saveNotes(updated);
        setNotes(updated);
      }
    } catch (err) {
      console.error('[updateNote]', err);
    }
  }, []);

  const deleteNote = useCallback(async (id: string): Promise<void> => {
    try {
      if (firestoreDb) {
        await deleteDoc(doc(firestoreDb, 'notes', id));
      } else {
        const updated = mockDb.getNotes().filter(n => n.id !== id);
        mockDb.saveNotes(updated);
        setNotes(updated);
      }
    } catch (err) {
      console.error('[deleteNote]', err);
    }
  }, []);

  const subscribeSharedNote = useCallback((
    noteId: string,
    callback: (note: ClipoNote | null) => void
  ): () => void => {
    if (firestoreDb) {
      return onSnapshot(doc(firestoreDb, 'notes', noteId), (snap) => {
        callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as ClipoNote) : null);
      });
    }

    // ── localStorage / same-browser mode ──────────────────────────────────────
    // Read once immediately
    const getNote = (): ClipoNote | null =>
      mockDb.getNotes().find(n => n.id === noteId) ?? null;

    // Fire immediately with a small delay to avoid React batching issues
    const timeoutId = setTimeout(() => callback(getNote()), 0);

    // Also subscribe to updates from other tabs
    const unsub = mockDb.onLocalSync((event) => {
      if (event.type === 'NOTES_UPDATED') {
        const found = (event.data as ClipoNote[]).find(n => n.id === noteId) ?? null;
        callback(found);
      }
    });

    return () => {
      clearTimeout(timeoutId);
      unsub();
    };
  }, []);

  const updateSharedNote = useCallback(async (
    noteId: string,
    updates: Partial<ClipoNote>
  ): Promise<void> => {
    await updateNote(noteId, updates);
  }, [updateNote]);

  return (
    <NoteContext.Provider value={{ notes, syncStatus, createNote, updateNote, deleteNote, subscribeSharedNote, updateSharedNote }}>
      {children}
    </NoteContext.Provider>
  );
};

export function useNotes() {
  const ctx = useContext(NoteContext);
  if (!ctx) throw new Error('useNotes must be used within NoteProvider');
  return ctx;
}
