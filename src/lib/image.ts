/** Longest side of the photo sent to the AI. Bigger photos cost more tokens without helping much. */
export const MAX_SIDE = 1568;
const THUMB_SIDE = 160;

export interface PreparedImage {
  dataUrl: string;
  thumb: string;
}

async function loadImage(file: Blob): Promise<{ img: HTMLImageElement; release: () => void }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('Nie udało się wczytać zdjęcia.');
  }
  return { img, release: () => URL.revokeObjectURL(url) };
}

function canvasOf(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Przeglądarka nie obsługuje przetwarzania zdjęć.');
  return { canvas, ctx };
}

/** Size that fits within `max` on the longest side, keeping the aspect ratio. */
export function fitSize(w: number, h: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Resizes a photo to JPEG for the AI and makes a square thumbnail for the diary. */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const { img, release } = await loadImage(file);
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    const size = fitSize(w, h, MAX_SIDE);
    const big = canvasOf(size.width, size.height);
    big.ctx.drawImage(img, 0, 0, size.width, size.height);
    const dataUrl = big.canvas.toDataURL('image/jpeg', 0.85);

    const side = Math.min(w, h);
    const small = canvasOf(THUMB_SIDE, THUMB_SIDE);
    small.ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, THUMB_SIDE, THUMB_SIDE);
    const thumb = small.canvas.toDataURL('image/jpeg', 0.7);

    return { dataUrl, thumb };
  } finally {
    release();
  }
}
