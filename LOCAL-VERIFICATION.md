# Perbaikan dan verifikasi lokal — 16 September 2026

## Hasil akhir

Lingkungan: Node 22.23.2, Google Chrome 152.0.7977.64.

- `npm ci`: berhasil (ESLint 9 masih memberi peringatan deprecation tooling).
- `npm run lint`: lulus tanpa error/warning lint.
- `npm run build`: lulus, tanpa peringatan chunk >500 KB.
- `PLAYWRIGHT_CHROME_CHANNEL=chrome npm run check`: lulus; 28/28 tes,
  terdiri dari 16 tes development dan 12 tes preview produksi (~1,9 menit).
- `npm audit` dan `npm audit --omit=dev`: 0 vulnerability saat pemeriksaan.
- `git diff --check`: lulus.

Tes mencakup kamera simulasi + model ONNX asli, real Sidoarjo, penolakan Jakarta
di mode real, keberhasilan Jakarta di mode lomba, perpindahan mode, izin kamera
ditolak lalu dicoba ulang, GPS gagal, retry storage, profil gagal dimuat, simpan
profil pengguna/admin sampai reload, registrasi email, route publik/admin,
viewport 390 px, konversi WebP, kontrak model, batas skor, dan duplikat lokasi.
Tidak ditemukan uncaught page error dalam skenario tersebut.

## Perilaku yang dipertahankan

- Foto pelapor diambil langsung dari kamera; tidak ada input unggah galeri.
- Mode real memerlukan GPS di dalam wilayah Sidoarjo (poligon kecamatan).
- Mode lomba menerima GPS valid dari daerah mana pun dan menampilkan penjelasan
  khusus demo. Catatan tersimpan ditandai `UJI COBA LOMBA — BEBAS LOKASI`.
- Mode lomba tidak memisahkan database. Ketika aplikasi tersambung ke backend
  asli, laporan mode ini tetap disimpan sebagai laporan dengan catatan uji coba.

## Perbaikan

- Inference YOLO mengikuti metadata input 960×960 dan empat kelas bawaan.
  Output divalidasi, bbox dibatasi foto, dan NMS diterapkan per kelas.
- ONNX WASM dilayani lokal dengan versi yang sama, tanpa ketergantungan CDN.
- React Router/Vite/plugin diperbarui; ESLint tersedia dan dapat dijalankan.
- Halaman dan grafik dipisah menjadi chunk agar tidak dimuat sekaligus.
- Layout mengikuti lebar viewport melalui `matchMedia`.
- Peta publik berpusat di Sidoarjo, memakai kolom lat/lng dari view, warna
  severity Indonesia, dan menyertakan laporan diterima/dikerjakan.
- Login menunggu profil, tidak menjalankan query di dalam auth lock, serta
  menyediakan retry jika profil gagal. Registrasi menampilkan instruksi email.
- Kamera membuang stream dari permintaan lama dan tetap bisa dicoba lagi.
- Perubahan mode memvalidasi ulang lokasi; tombol terkunci selama operasi
  berjalan. GPS memiliki timeout dan kegagalan ditampilkan.
- Tanpa CLIP, duplikat disarankan berdasarkan jenis dan radius 50 m, tidak
  diklaim sebagai kemiripan visual dan tidak digabung otomatis.
- Retry foto pada tab yang sama memakai ID laporan yang sudah dibuat sehingga
  kegagalan storage tidak langsung membuat laporan baru saat dikirim ulang.

## Cara menjalankan pemeriksaan

```bash
npm ci
npx playwright install chromium
npm run check
npm audit
```

Alternatif browser sistem: `PLAYWRIGHT_CHROME_CHANNEL=chrome npm test`.
Playwright menjalankan port 5175/4175, memaksa URL/key Supabase dummy, dan
menangani semua request eksternal dengan fixture lokal. Model YOLO tetap asli.
Tidak ada deployment, migrasi, akun baru, ataupun write database asli.

## Batas bukti pengujian

- Lulus inference sintetis membuktikan kontrak model dan pipeline berjalan,
  bukan precision/recall atau akurasi tingkat kerusakan. Itu memerlukan dataset
  foto jalan berlabel dan kalibrasi, termasuk dampak kompresi WebP.
- CLIP belum disediakan. Saran lokasi/jenis tidak menggantikan encoder visual.
- Backend disimulasikan; RLS, constraint, storage policy, email konfirmasi,
  dan perubahan status dengan akun asli belum diverifikasi oleh suite ini.
- Kamera/GPS nyata di Android/iOS dan kecepatan model 45 MB pada HP juri perlu
  diuji pada perangkat tersebut. Izin dan HTTPS tetap merupakan prasyarat browser.
- Insert laporan dan upload foto masih dua operasi backend. Retry pada tab yang
  sama ditangani, tetapi menutup tab setelah insert/gagal upload dapat menyisakan
  laporan tanpa foto. Transaksi/cleanup backend memerlukan migrasi terpisah.
- Mode real adalah validasi frontend, bukan bukti keaslian GPS. Mode lomba
  sengaja tersedia untuk semua lokasi sesuai kebutuhan penilaian.
- Tombol lupa sandi masih menampilkan bahwa fitur belum tersedia. Alur email
  recovery lengkap belum menjadi bagian perubahan ini.

Referensi upgrade: [Vite 7 migration](https://v7.vite.dev/guide/migration)
dan [React Router security advisories](https://github.com/remix-run/react-router/security/advisories).
