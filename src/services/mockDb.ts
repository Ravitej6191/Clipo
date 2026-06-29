import type { ClipoNote, UserProfile } from '../types';

const DEFAULT_USER: UserProfile = {
  uid: 'mock-user-123',
  email: 'demo@clipo.app',
  displayName: 'Demo User',
  connectedDevices: ['Web Browser'],
};

// BroadcastChannel for cross-tab local real-time synchronization
let syncChannel: BroadcastChannel | null = null;
try {
  syncChannel = new BroadcastChannel('clipo_local_sync');
} catch {
  // BroadcastChannel not supported (e.g. private Safari)
}

// LocalStorage Helper Get/Set
const getStorageItem = <T>(key: string, defaultValue: T): T => {
  try {
    const data = localStorage.getItem(key);
    if (!data) return defaultValue;
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
};

const setStorageItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or private mode
  }
};

export const mockDb = {
  getNotes: (): ClipoNote[] => {
    // Start with empty notes — no mock data for clean no-auth app
    return getStorageItem('clipo_notes_v2', []);
  },

  saveNotes: (notes: ClipoNote[]): void => {
    setStorageItem('clipo_notes_v2', notes);
    syncChannel?.postMessage({ type: 'NOTES_UPDATED', data: notes });
  },

  getUser: (): UserProfile => {
    return getStorageItem<UserProfile>('clipo_user_v1', DEFAULT_USER);
  },

  updateUser: (user: UserProfile): void => {
    setStorageItem('clipo_user_v1', user);
    syncChannel?.postMessage({ type: 'USER_UPDATED', data: user });
  },

  // Setup Listener for multi-tab local sync
  onLocalSync: (callback: (event: { type: string; data: any }) => void) => {
    if (!syncChannel) return () => {};
    const handler = (e: MessageEvent) => {
      callback(e.data);
    };
    syncChannel.addEventListener('message', handler);
    return () => syncChannel!.removeEventListener('message', handler);
  }
};
