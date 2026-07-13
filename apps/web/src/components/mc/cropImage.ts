// Center-square crop + resize to a small avatar blob, entirely client-side (no
// cropper dependency). ~256px JPEG keeps the stored blob at a few tens of KB.
export const AVATAR_SIZE = 256;

export async function toAvatarBlob(file: File, size = AVATAR_SIZE): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("avatar encode failed"))), "image/jpeg", 0.85),
    );
  } finally {
    bitmap.close();
  }
}
