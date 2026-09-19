export const PHOTO_MAX_BYTES = 99_999;
export const PHOTO_INPUT_ACCEPT = 'image/jpeg,image/png,image/webp';
const INPUT_MAX_BYTES = 25 * 1024 * 1024;
const preparedPhotos = new WeakSet();

export async function validateUploadPhoto(file) {
  if (!file || file.type !== 'image/webp' || file.size === 0 || file.size > PHOTO_MAX_BYTES) {
    throw new Error('Foto harus berformat WebP dan berukuran di bawah 100 KB.');
  }
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = (start, end) => String.fromCharCode(...header.slice(start, end));
  if (text(0, 4) !== 'RIFF' || text(8, 12) !== 'WEBP') {
    throw new Error('Isi file bukan gambar WebP yang valid.');
  }
}

export async function prepareUploadPhoto(file) {
  if (file && preparedPhotos.has(file)) {
    await validateUploadPhoto(file);
    return file;
  }
  if (!(file instanceof Blob) || !file.size) throw new Error('Pilih foto yang tidak kosong.');
  const accepted = PHOTO_INPUT_ACCEPT.split(',');
  if (
    !accepted.includes(file.type) &&
    !(file.type === '' && /\.(jpe?g|png|webp)$/i.test(file.name || ''))
  ) {
    throw new Error('Pilih foto JPEG, PNG, atau WebP.');
  }
  if (file.size > INPUT_MAX_BYTES)
    throw new Error('Foto asli terlalu besar. Pilih foto maksimal 25 MB.');

  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement('canvas');
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Foto tidak bisa dibaca. Pilih gambar lain.'));
      image.src = sourceUrl;
    });
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    if (!longestSide) throw new Error('Ukuran gambar tidak valid.');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Browser tidak dapat memproses foto.');
    let targetSide = Math.min(1600, longestSide);
    for (;;) {
      const scale = targetSide / longestSide;
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.72, 0.58, 0.42]) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob || blob.type !== 'image/webp') {
          throw new Error('Browser ini belum mendukung konversi WebP. Gunakan browser terbaru.');
        }
        if (blob.size > 0 && blob.size <= PHOTO_MAX_BYTES) {
          const stem =
            (file.name || 'foto')
              .replace(/\.[^.]+$/, '')
              .replace(/[^a-zA-Z0-9_-]/g, '-')
              .slice(0, 80) || 'foto';
          const result = new File([blob], `${stem}.webp`, {
            type: 'image/webp',
            lastModified: file.lastModified ?? Date.now(),
          });
          await validateUploadPhoto(result);
          preparedPhotos.add(result);
          return result;
        }
      }
      if (targetSide <= 128) break;
      targetSide = Math.max(128, Math.floor(targetSide * 0.75));
    }
    throw new Error('Foto belum bisa diperkecil hingga di bawah 100 KB. Pilih foto lain.');
  } finally {
    URL.revokeObjectURL(sourceUrl);
    image.src = '';
    canvas.width = canvas.height = 1;
  }
}
