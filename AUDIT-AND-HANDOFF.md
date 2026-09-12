# Pemeriksaan deployment Jasida — 12 September 2026

## Hasil yang sudah diperiksa

- Build produksi lolos. Website: https://jasida.vercel.app.
- Halaman beranda, daftar laporan, dan login tampil; avatar dan foto laporan
  dapat dimuat. File model YOLO dan classifier tersedia pada hosting.
- Metadata model YOLO sesuai urutan enam kelas di frontend dan input 640×640.
- Model YOLO sungguhan berjalan di browser. Tiga foto laporan diperiksa sebelum
  dan sesudah WebP: jumlah deteksi masing-masing tetap 10, 2, dan 10; kategori
  tetap `darurat` dengan skor hasil WebP 86, 70, dan 71.
- Hasil WebP ketiga foto: 98.252, 37.296, dan 75.612 byte. Batas kompresi,
  file invalid, dan kedua entrypoint upload diuji dengan transport pengujian.
- Pengguna menjalankan konfigurasi bucket dan mendapat verifikasi
  `image/webp`, maksimal 99.999 byte. File lama tidak berubah.

## Batasan dan perubahan hasil pemeriksaan

- Tiga sampel bukan pengukuran akurasi. Belum ada dataset berlabel untuk
  mengukur precision/recall atau perubahan akurasi akibat kompresi.
- Halaman laporan memakai YOLO ditambah `computeHazardScore`: skor 0–34
  rendah, 35–69 sedang, dan 70–100 darurat. Model terpisah
  `severity-classifier.onnx` tersedia tetapi tidak digunakan halaman laporan.
  Model itu tidak boleh dianggap sebagai model penentu label yang ditampilkan.
- `clip-image-encoder.onnx` belum tersedia. Pemeriksaan visual duplikat belum
  aktif. Jalur laporan sekarang memakai embedding null, memberi keterangan
  bahwa pemeriksaan tidak tersedia, dan tidak memakai pseudo-embedding.
- Jika deteksi utama gagal, laporan tidak diteruskan menggunakan hasil mock.
  Pengguna melihat error dan perlu mencoba foto/analisis kembali.
- Pengiriman laporan ditahan sampai GPS terdeteksi dalam batas Sidoarjo.
  Pemeriksaan lokasi saat ini memakai bounding rectangle, bukan verifikasi
  batas administratif penuh atau pencegahan pemalsuan GPS.
- Alur tulis lengkap dengan akun pengguna/admin belum diverifikasi otomatis.
  Supabase RLS aktual belum diaudit dari dashboard. `supabase/schema.sql`
  merupakan skema awal dan tidak mewakili seluruh konfigurasi database live.
- Baris laporan dibuat sebelum foto diunggah; kegagalan upload setelah insert
  masih dapat menyisakan laporan tanpa foto. Retry/cleanup transaksional perlu
  dikerjakan jika aplikasi dipakai lebih luas.

## Perkiraan kapasitas

Listing yang dapat dibaca pada bucket `report-images` menunjukkan 10 file,
total 635.066 byte (~0,64 MB), dengan 7 laporan dan 3 foto tambahan.
Angka ini bukan dashboard billing organisasi dan bukan total semua bucket.

Dengan paling banyak 100 foto/hari × 19 hari × 99.999 byte, tambahan sampai
30 September sekitar 190 MB. Ditambah isi bucket yang terbaca, sekitar 191 MB.
Kuota Supabase Free saat diperiksa: file storage 1 GB, database 500 MB,
egress 5 GB, dan cached egress 5 GB. Sumber: https://supabase.com/pricing.
Foto tersimpan bersifat kumulatif, tidak otomatis kosong saat ganti bulan.

Trafik unduhan tidak sama dengan storage: 10 foto × 100 KB ≈ 1 MB per muatan
tanpa cache; 5.000 muatan seperti ini ≈ 5 GB, belum termasuk API lain.
Periksa Organization > Usage untuk total egress/cached egress dan project lain.
SQL `supabase/audit-deployment.sql` hanya membaca kapasitas dan policy aktual.

## Cara teman melanjutkan kode

Perubahan deploy dan WebP berada di branch `setup/vercel-deployment`, belum
dipush ke GitHub. Jangan mulai dari `main` lama tanpa mengambil perubahan ini.
Paket Git `jasida-setup.bundle` dibuat untuk dibagikan manual; paket tidak
memuat `.env`, `.env.local`, `.vercel`, atau key Supabase.

Teman yang sudah mempunyai clone dengan commit `18aec41` dapat menjalankan:

```bash
git fetch /path/ke/jasida-setup.bundle setup/vercel-deployment:setup/vercel-deployment
git switch setup/vercel-deployment
npm ci
```

Salin `.env.example` ke `.env` dan isi URL serta public key project yang sama.
Buat branch kerja dari versi tersebut dan jalankan pemeriksaan sebelum review:

```bash
npm run build
# Dengan npm run dev berjalan di terminal lain:
npx agent-browser open http://127.0.0.1:5173
npx agent-browser eval --stdin < tests/image-upload.browser.js
npx agent-browser eval --stdin < tests/ai-audit.browser.js
npx agent-browser close
```

Jaga kontrak penting: upload melalui `prepareUploadPhoto`, MIME WebP dan
batas 99.999 byte; jangan menaruh key admin di frontend; perubahan nama kelas,
input/output model, tabel/RPC, dan aturan skor memerlukan pengujian ulang.
Jangan menjalankan ulang skema awal di database live tanpa migration yang ditinjau.

Deployment saat ini melalui CLI akun `iszz100`, bukan otomatis setiap push.
Preview perlu diuji sebelum deploy production. Akses kolaborator GitHub tidak
otomatis memberi akses project Vercel; deployment sebelumnya pernah diblokir
karena penulis commit tidak memiliki akses ke project Vercel. Jangan mengubah
identitas penulis commit teman hanya untuk melewati pemeriksaan tersebut.
Atur akses/integrasi dengan pemilik repo dan workspace yang sesuai.
