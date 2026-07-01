const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME   as string;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;
const API_KEY       = import.meta.env.VITE_CLOUDINARY_API_KEY        as string;
const API_SECRET    = import.meta.env.VITE_CLOUDINARY_API_SECRET     as string;

export const isCloudinaryConfigured = !!(CLOUD_NAME && UPLOAD_PRESET);

type ResourceType = 'image' | 'video' | 'raw';

function resourceType(mime: string): ResourceType {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'video';
  return 'raw';
}

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

export async function uploadToCloudinary(
  blob: Blob,
  fileName: string,
  onProgress?: (pct: number) => void,
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured) {
    // Fallback to base64 data URL (works offline / no config)
    const url = await new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onload  = (e) => res(e.target?.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
    return { url, publicId: '' };
  }

  const rt  = resourceType(blob.type || 'application/octet-stream');
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${rt}/upload`;

  const form = new FormData();
  form.append('file', blob, fileName);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', 'clipo');

  return new Promise((res, rej) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.((e.loaded / e.total) * 100);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        res({ url: data.secure_url as string, publicId: data.public_id as string });
      } else {
        rej(new Error(`Cloudinary error ${xhr.status}: ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => rej(new Error('Network error during upload'));
    xhr.send(form);
  });
}

async function sha1(message: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function deleteFromCloudinary(publicId: string, mime: string): Promise<void> {
  if (!isCloudinaryConfigured || !API_KEY || !API_SECRET || !publicId) return;
  const rt        = resourceType(mime);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await sha1(`public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`);

  const form = new FormData();
  form.append('public_id', publicId);
  form.append('timestamp', timestamp);
  form.append('api_key', API_KEY);
  form.append('signature', signature);

  try {
    await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${rt}/destroy`, {
      method: 'POST',
      body: form,
    });
  } catch { /* best-effort — ignore network errors on delete */ }
}
