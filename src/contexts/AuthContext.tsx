import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  isFirebaseReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      // Clear guest mode when user signs in
      if (u) setIsGuest(false);
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
    setIsGuest(false);
  };

  const enterGuestMode = () => setIsGuest(true);
  const exitGuestMode  = () => setIsGuest(false);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isGuest,
      isFirebaseReady: isFirebaseConfigured,
      signInWithGoogle,
      signOut,
      enterGuestMode,
      exitGuestMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
