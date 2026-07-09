import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  deleteUser,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured, db } from '../services/firebase';
import {
  collection, getDocs, query, where,
  deleteDoc, updateDoc, doc, setDoc, arrayRemove,
} from 'firebase/firestore';
import { deleteFile } from '../services/storage';
import type { ClipoNote } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u && db) {
        setDoc(doc(db, 'users', u.uid), {
          uid: u.uid,
          email: u.email,
          name: u.displayName,
          photoURL: u.photoURL,
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
      }
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) throw new Error('Firebase not configured');
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  };

  const deleteAccount = async () => {
    if (!auth?.currentUser || !db) throw new Error('Not signed in');
    const uid = auth.currentUser.uid;

    // 1. Load all owned notes (both field names for backward compat)
    const [snapNew, snapOld] = await Promise.all([
      getDocs(query(collection(db, 'notes'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'notes'), where('userId',  '==', uid))),
    ]);
    const ownedDocs = [
      ...snapNew.docs,
      ...snapOld.docs.filter(d => !snapNew.docs.find(n => n.id === d.id)),
    ];
    const ownedNotes = ownedDocs.map(d => d.data() as ClipoNote);

    // 2. Delete Storage files from owned notes (best-effort)
    const storageDeletes: Promise<void>[] = [];
    for (const note of ownedNotes) {
      for (const att of note.attachments ?? []) {
        if (att.storagePath) storageDeletes.push(deleteFile(att.storagePath));
      }
    }
    await Promise.allSettled(storageDeletes);

    // 3. Delete owned Firestore note documents
    await Promise.allSettled(ownedDocs.map(d => deleteDoc(doc(db!, 'notes', d.id))));

    // 4. Remove this user from collaborator lists in notes they were invited to
    const sharedSnap = await getDocs(
      query(collection(db, 'notes'), where('collaboratorUids', 'array-contains', uid))
    );
    const collabRemoves = sharedSnap.docs.map(async d => {
      const note = d.data() as ClipoNote;
      const collab = (note.collaborators ?? []).find(c => c.uid === uid);
      const patch: Record<string, unknown> = {
        collaboratorUids: arrayRemove(uid),
        editorUids: arrayRemove(uid),
      };
      if (collab) patch.collaborators = arrayRemove(collab);
      await updateDoc(doc(db!, 'notes', d.id), patch);
    });
    await Promise.allSettled(collabRemoves);

    // 5. Delete user profile document
    await deleteDoc(doc(db!, 'users', uid)).catch(() => {});

    // 6. Delete Firebase Auth user (must be last)
    await deleteUser(auth.currentUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
