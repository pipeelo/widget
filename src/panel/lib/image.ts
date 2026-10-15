const MAX_SIDE = 2048;
const JPEG_QUALITY = 0.85;
const SHRINK_ABOVE_BYTES = 4 * 1024 * 1024;
const READY_MIMES = ['image/jpeg', 'image/png'];
const IMAGE_EXTENSION = /\.(heic|heif|webp|avif|jpe?g|png|gif|bmp)$/i;

export type ImagePrep =
  | { kind: 'untouched' }
  | { kind: 'converted'; file: File }
  | { kind: 'failed' };

function mimeOf(file: File): string {
  return ((file.type || '').split(';')[0] ?? '').trim().toLowerCase();
}

function isReady(file: File): boolean {
  return READY_MIMES.indexOf(mimeOf(file)) !== -1;
}

export function isImageSource(file: File): boolean {
  const mime = mimeOf(file);
  if (mime) return mime.startsWith('image/');
  return IMAGE_EXTENSION.test(file.name || '');
}

function needsPrep(file: File): boolean {
  if (!isImageSource(file)) return false;
  if (!isReady(file)) return true;
  return file.size > SHRINK_ABOVE_BYTES;
}

type Drawable = { source: CanvasImageSource; width: number; height: number; release(): void };

async function decodeWithBitmap(file: File): Promise<Drawable | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    return null;
  }
}

function decodeWithElement(file: File): Promise<Drawable | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const release = () => URL.revokeObjectURL(url);
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        release();
        resolve(null);
        return;
      }
      resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, release });
    };
    img.onerror = () => {
      release();
      resolve(null);
    };
    img.src = url;
  });
}

function jpegName(name: string): string {
  const base = (name || '').replace(/\.[^./\\]+$/, '') || `foto-${Date.now()}`;
  return `${base}.jpg`;
}

function encodeJpeg(drawable: Drawable, name: string): Promise<File | null> {
  const scale = Math.min(1, MAX_SIDE / Math.max(drawable.width, drawable.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(drawable.width * scale));
  canvas.height = Math.max(1, Math.round(drawable.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return Promise.resolve(null);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(drawable.source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? new File([blob], jpegName(name), { type: 'image/jpeg' }) : null),
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

export async function prepareImage(file: File): Promise<ImagePrep> {
  if (!needsPrep(file)) return { kind: 'untouched' };
  const drawable = (await decodeWithBitmap(file)) ?? (await decodeWithElement(file));
  if (!drawable) return isReady(file) ? { kind: 'untouched' } : { kind: 'failed' };
  try {
    const converted = await encodeJpeg(drawable, file.name);
    if (converted) return { kind: 'converted', file: converted };
    return isReady(file) ? { kind: 'untouched' } : { kind: 'failed' };
  } catch {
    return isReady(file) ? { kind: 'untouched' } : { kind: 'failed' };
  } finally {
    drawable.release();
  }
}
