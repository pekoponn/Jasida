# Setup dan deploy Jasida

- Website: https://jasida.vercel.app
- Dashboard Vercel: https://vercel.com/iszz100s-projects/jasida
- Akun Vercel: `iszz100`, workspace `iszz100s-projects`, project `jasida`.
- Supabase: https://supabase.com/dashboard/project/zduhufrmvvlvuyzpqscu

## Frontend dan backend

Vercel membangun React + Vite menjadi file statis dari folder ini. Aplikasi
di browser mengakses Supabase untuk database, autentikasi, dan penyimpanan
foto. Model ONNX ikut disajikan sebagai file statis oleh Vercel.

Project Supabase sudah memiliki data dan tabel yang digunakan aplikasi.
Tidak perlu membuat database baru atau menjalankan ulang `supabase/schema.sql`
untuk deployment frontend ini; file tersebut hanya berisi skema awal.

## Konfigurasi Vercel

| Pengaturan | Nilai |
| --- | --- |
| Framework | Vite |
| Root Directory | `.` (root repository) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | Default (`npm install`) |

`vercel.json` mengatur fallback ke `index.html` agar URL seperti `/login`,
`/dashboard`, dan `/riwayat` tetap berjalan saat dibuka langsung.

Dua variabel berikut sudah dipasang untuk Production, Preview, dan Development:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (key publik/anon; bukan secret/service_role)

Nilai asli disimpan di `.env` lokal dan Environment Variables Vercel.
`.env.example` hanya template; Vite tidak membaca file itu.
Perubahan variabel frontend di Vercel memerlukan deployment ulang.

## Menjalankan lokal

Pada mesin baru, salin `.env.example` ke `.env` lalu isi kedua variabel dengan
konfigurasi Supabase project yang sama. Setelah itu:

```bash
npm install
npm run dev
```

## Memperbarui website

Deployment pertama menggunakan Vercel CLI dari folder lokal. Integrasi
deployment otomatis dari GitHub belum dipasang. Akses kolaborator GitHub
dan akses project Vercel dikelola terpisah.

Vercel juga memeriksa akses penulis commit untuk repo private. Deployment
pembaruan pernah diblokir karena commit terakhir berasal dari pemilik repo
GitHub yang bukan anggota project Vercel ini. Perubahan setup disimpan sebagai
commit lokal di branch `setup/vercel-deployment`, memakai identitas akun
Vercel `iszz100`. Branch ini belum dipush ke GitHub.

Untuk deployment otomatis bersama tim, pemilik repo perlu memasang integrasi
GitHub dan memastikan akses kolaborator sesuai paket/workspace Vercel.

Setelah mengambil atau menyelesaikan perubahan kode, jalankan:

```bash
npm install
npm run build
npx vercel deploy --prod --scope iszz100s-projects
```

Jika login CLI kedaluwarsa, jalankan `npx vercel login` dengan akun `iszz100`.
Pada mesin baru, hubungkan folder dengan:

```bash
npx vercel link --yes --project jasida --scope iszz100s-projects
```

File `.vercel/project.json` menyimpan hubungan folder dengan project Vercel
dan tidak perlu dimasukkan ke Git.

## Foto WebP di bawah 100 KB

Foto kamera, pilihan JPEG/PNG/WebP, dukungan, dan bukti perbaikan dikonversi
di browser sebelum upload. Ukuran awal maksimal 25 MB. Aplikasi mengurangi
dimensi dan kualitas bertahap, memeriksa MIME dan signature WebP, dan hanya
mengirim hasil maksimal 99.999 byte (di bawah 100 KB desimal).
Foto untuk laporan baru sudah dikonversi sebelum analisis AI dan pembuatan
baris laporan. Foto galeri menggunakan GPS saat dipilih, bukan lokasi EXIF.
Kompresi lossy dapat mengurangi detail foto; preview menampilkan hasil yang
akan dianalisis dan dikirim.

Pembatasan server di bucket `report-images` harus diterapkan juga:

- Allowed MIME types: `image/webp`
- File size limit: `99999` byte

Jalankan `npm run storage:configure` di terminal lokal. Script meminta
Supabase secret key atau legacy service_role key dengan input tersembunyi,
membaca bucket yang ada, mengubah hanya pembatasan upload, lalu memverifikasi
hasilnya. Key admin tidak disimpan ke file, Vercel, atau bundle frontend.
Jangan masukkan key admin ke variabel `VITE_`. Foto lama tidak dikonversi atau
dihapus. Pembatasan ini tidak mengubah policy akses bucket yang ada.

Untuk menguji konversi tanpa menulis data ke Supabase:

```bash
# Jalankan npm run dev di terminal lain terlebih dahulu.
npx agent-browser open http://127.0.0.1:5173
npx agent-browser eval --stdin < tests/image-upload.browser.js
npx agent-browser close
```

Pengujian mencakup JPEG/PNG besar, WebP kecil, rasio ekstrem, file rusak,
MIME salah, batas 100 KB, browser tanpa encoder WebP, serta kedua jalur upload
dengan transport pengujian yang tidak mengirim data ke database.
