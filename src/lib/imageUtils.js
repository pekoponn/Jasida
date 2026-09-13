/**
 * Konversi File gambar (JPEG/PNG/dll) menjadi File WebP di sisi browser,
 * biar ukuran upload ke Supabase Storage lebih kecil (kuota 500MB lebih awet).
 *
 * @param {File} file - file gambar asli (hasil dari input/kamera)
 * @param {number} quality - 0 sampai 1, makin kecil makin kecil ukurannya tapi makin turun kualitas
 * @returns {Promise<File>} file baru berformat WebP (atau file asli kalau gagal/tidak didukung)
 */
export function convertToWebp(file, quality = 0.82) {
  return new Promise((resolve) => {
    if (!file || !file.type?.startsWith('image/')) {
      resolve(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob || blob.type !== 'image/webp') {
            resolve(file);
            return;
          }

          const newName = file.name.replace(/\.[^.]+$/, '') + '.webp';
          resolve(new File([blob], newName, { type: 'image/webp' }));
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}