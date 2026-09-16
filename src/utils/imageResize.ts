// Getting a phone photo down to something worth uploading.
//
// Photos go to Firebase Storage as data URLs. A picture straight from the
// camera roll is commonly 5-12 MB, and base64 adds about a third on top, so
// uploading originals over a hotel connection is slow enough to look broken.
// Everything here is best-effort: if a file cannot be decoded it is uploaded
// untouched rather than lost.

/** Longest edge, in pixels, of a stored photo. */
export const MAX_PHOTO_EDGE = 1600;

/** JPEG quality for the re-encode. */
export const PHOTO_QUALITY = 0.82;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

/** Scale to fit inside a square of `maxEdge`, never enlarging. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!longest || longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Decode a file to something canvas can draw, honouring EXIF rotation. */
async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Without from-image, a portrait photo taken on a phone comes out
      // sideways: the pixels are landscape and the rotation lives in EXIF.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through — older Safari rejects the options argument.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode the image'));
      img.src = url;
    });
  } finally {
    // Revoking immediately after load is safe: the bitmap is already decoded.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/**
 * A data URL for this photo, scaled down when it is larger than needed.
 *
 * Falls back to the untouched file whenever the browser cannot decode it —
 * an iPhone can hand over a HEIC that canvas will not draw, and an upload at
 * full size is far better than refusing the photo.
 */
export async function downscaleToDataUrl(
  file: File,
  maxEdge: number = MAX_PHOTO_EDGE,
  quality: number = PHOTO_QUALITY
): Promise<string> {
  try {
    const source = await decode(file);
    const { width, height } = fitWithin(source.width, source.height, maxEdge);

    // Already small enough — re-encoding would only lose quality.
    if (width === source.width && height === source.height && file.size < 1_200_000) {
      return await readFileAsDataUrl(file);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return await readFileAsDataUrl(file);
    ctx.drawImage(source, 0, 0, width, height);
    if ('close' in source && typeof source.close === 'function') source.close();

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    // A canvas tainted or empty for any reason yields a stub; keep the original.
    return dataUrl.length > 'data:image/jpeg;base64,'.length + 100
      ? dataUrl
      : await readFileAsDataUrl(file);
  } catch {
    return readFileAsDataUrl(file);
  }
}
