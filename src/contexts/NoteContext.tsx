import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ClipoNote, Collaborator, CollaboratorRole } from '../types';
import { db } from '../services/firebase';
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

interface NoteContextType {
  notes: ClipoNote[];
  sharedNotes: ClipoNote[];
  notesLoading: boolean;
  createNote: (
    title: string,
    content: string,
    attachments: ClipoNote['attachments'],
    passwordHash?: string,
  ) => Promise<string>;
  updateNote: (id: string, updates: Partial<ClipoNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  subscribeSharedNote: (
    noteId: string,
    callback: (note: ClipoNote | null) => void,
    onError?: (err: Error) => void,
  ) => () => void;
  addCollaborator: (noteId: string, email: string, role: CollaboratorRole) => Promise<void>;
  removeCollaborator: (noteId: string, uid: string) => Promise<void>;
  updateCollaboratorRole: (noteId: string, uid: string, role: CollaboratorRole) => Promise<void>;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

export const NoteProvider: React.FC<{
  children: React.ReactNode;
  userId: string;
}> = ({ children, userId }) => {
  const [notes, setNotes]             = useState<ClipoNote[]>([]);
  const [sharedNotes, setSharedNotes] = useState<ClipoNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);

  // Subscribe to owned notes — queries both ownerId (new) and userId (legacy)
  useEffect(() => {
    if (!db || !userId) { setNotes([]); setNotesLoading(false); return; }

    setNotesLoading(true);
    const qNew = query(collection(db, 'notes'), where('ownerId', '==', userId));
    const qOld = query(collection(db, 'notes'), where('userId',  '==', userId));

    const seen = new Map<string, ClipoNote>();
    let resolvedNew = false;
    let resolvedOld = false;

    const merge = () => {
      if (resolvedNew && resolvedOld) {
        setNotes(Array.from(seen.values()));
        setNotesLoading(false);
      }
    };

    const unsubNew = onSnapshot(qNew, snap => {
      snap.docs.forEach(d => seen.set(d.id, { id: d.id, ...d.data() } as ClipoNote));
      resolvedNew = true;
      merge();
    }, () => { resolvedNew = true; merge(); });

    const unsubOld = onSnapshot(qOld, snap => {
      snap.docs.forEach(d => {
        if (!seen.has(d.id)) seen.set(d.id, { id: d.id, ...d.data() } as ClipoNote);
      });
      resolvedOld = true;
      merge();
    }, () => { resolvedOld = true; merge(); });

    return () => { unsubNew(); unsubOld(); };
  }, [userId]);

  // Subscribe to notes shared with this user
  useEffect(() => {
    if (!db || !userId) { setSharedNotes([]); return; }
    const q = query(collection(db, 'notes'), where('collaboratorUids', 'array-contains', userId));
    return onSnapshot(q, snap => {
      setSharedNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClipoNote)));
    }, () => setSharedNotes([]));
  }, [userId]);

  const createNote = useCallback(async (
    title: string,
    content: string,
    attachments: ClipoNote['attachments'],
    passwordHash?: string,
  ): Promise<string> => {
    if (!db) throw new Error('Firebase not configured');
    const noteId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const newNote: ClipoNote = {
      id: noteId,
      title: title || 'Untitled Space',
      content,
      attachments: attachments ?? [],
      createdAt: now,
      updatedAt: now,
      ownerId: userId,
      ...(passwordHash ? { passwordHash } : {}),
    };
    await setDoc(doc(db, 'notes', noteId), newNote);
    setNotes(prev => [newNote, ...prev.filter(n => n.id !== noteId)]);
    return noteId;
  }, [userId]);

  const updateNote = useCallback(async (id: string, updates: Partial<ClipoNote>): Promise<void> => {
    if (!db) throw new Error('Firebase not configured');
    const patch = { ...updates, updatedAt: new Date().toISOString() };
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
    await updateDoc(doc(db, 'notes', id), patch);
  }, []);

  const deleteNote = useCallback(async (id: string): Promise<void> => {
    if (!db) throw new Error('Firebase not configured');
    // Optimistic update so UI removes the card immediately
    setNotes(prev => prev.filter(n => n.id !== id));
    await deleteDoc(doc(db, 'notes', id));
  }, []);

  const subscribeSharedNote = useCallback((
    noteId: string,
    callback: (note: ClipoNote | null) => void,
    onError?: (err: Error) => void,
  ): () => void => {
    if (!db) { callback(null); return () => {}; }
    return onSnapshot(
      doc(db, 'notes', noteId),
      snap => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as ClipoNote) : null),
      err => { if (onError) onError(err); else callback(null); },
    );
  }, []);

  const addCollaborator = useCallback(async (noteId: string, email: string, role: CollaboratorRole): Promise<void> => {
    if (!db) throw new Error('Firebase not configured');
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
    if (snap.empty) throw new Error('No Clipo account found for that email.');
    const userDoc = snap.docs[0].data();
    const collab: Collaborator = {
      uid: userDoc.uid,
      email: userDoc.email,
      name: userDoc.name ?? undefined,
      photoURL: userDoc.photoURL ?? undefined,
      role,
      addedAt: new Date().toISOString(),
    };
    const patch: Record<string, unknown> = {
      collaborators: arrayUnion(collab),
      collaboratorUids: arrayUnion(userDoc.uid),
    };
    if (role === 'editor') patch.editorUids = arrayUnion(userDoc.uid);
    await updateDoc(doc(db, 'notes', noteId), patch);
  }, []);

  const removeCollaborator = useCallback(async (noteId: string, uid: string): Promise<void> => {
    if (!db) throw new Error('Firebase not configured');
    const noteSnap = await getDoc(doc(db, 'notes', noteId));
    if (!noteSnap.exists()) return;
    const noteData = noteSnap.data() as ClipoNote;
    const collab = (noteData.collaborators ?? []).find(c => c.uid === uid);
    if (!collab) return;
    await updateDoc(doc(db, 'notes', noteId), {
      collaborators: arrayRemove(collab),
      collaboratorUids: arrayRemove(uid),
      editorUids: arrayRemove(uid),
    });
  }, []);

  const updateCollaboratorRole = useCallback(async (noteId: string, uid: string, role: CollaboratorRole): Promise<void> => {
    if (!db) throw new Error('Firebase not configured');
    const noteSnap = await getDoc(doc(db, 'notes', noteId));
    if (!noteSnap.exists()) return;
    const noteData = noteSnap.data() as ClipoNote;
    const oldCollab = (noteData.collaborators ?? []).find(c => c.uid === uid);
    if (!oldCollab) return;
    const newCollab: Collaborator = { ...oldCollab, role };
    const patch: Record<string, unknown> = {
      collaborators: arrayUnion(newCollab),
    };
    // Keep editorUids in sync with role changes
    if (role === 'editor') {
      patch.editorUids = arrayUnion(uid);
    } else {
      patch.editorUids = arrayRemove(uid);
    }
    await updateDoc(doc(db, 'notes', noteId), { collaborators: arrayRemove(oldCollab) });
    await updateDoc(doc(db, 'notes', noteId), patch);
  }, []);

  return (
    <NoteContext.Provider value={{
      notes, sharedNotes, notesLoading,
      createNote, updateNote, deleteNote, subscribeSharedNote,
      addCollaborator, removeCollaborator, updateCollaboratorRole,
    }}>
      {children}
    </NoteContext.Provider>
  );
};

export function useNotes() {
  const ctx = useContext(NoteContext);
  if (!ctx) throw new Error('useNotes must be used within NoteProvider');
  return ctx;
}
