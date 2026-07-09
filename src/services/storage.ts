import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export interface UploadResult {
  url: string;
  storagePath: string;
  bytes: number;
}

export async function uploadFile(
  blob: Blob,
  userId: string,
  fileName: string,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  if (!storage) {
    // Fallback: base64 data URL (no Firebase Storage configured)
    const url = await new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onload = (e) => res(e.target?.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
    return { url, storagePath: '', bytes: blob.size };
  }

  const ext = fileName.split('.').pop() ?? 'bin';
  const path = `users/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const storageRef = ref(storage, path);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob);

    task.on('state_changed',
      (snap) => onProgress?.((snap.bytesTransferred / snap.totalBytes) * 100),
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, storagePath: path, bytes: blob.size });
      },
    );
  });
}

export async function deleteFile(storagePath: string): Promise<void> {
  if (!storage || !storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch { /* best-effort */ }
}
