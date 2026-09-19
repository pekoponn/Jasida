# Menjalankan Jasida di Vercel

Dokumen ini dipakai saat website perlu dipasang ulang atau diperbarui.

- Website: [www.jasida.web.id](https://www.jasida.web.id/)
- Project Vercel: `iszz100s-projects/jasida`
- Project Supabase: `zduhufrmvvlvuyzpqscu`

## Gambaran singkat

Vercel menyajikan aplikasi React, file gambar, dan model ONNX. Supabase menangani
akun, database, serta penyimpanan foto laporan. Database yang digunakan website
sudah aktif, jadi pembaruan frontend tidak memerlukan database baru.

Jangan menjalankan `supabase/schema.sql` pada database production tanpa meninjau
query-nya. File tersebut disimpan sebagai contoh skema awal, bukan migration.

## Pengaturan build

| Pengaturan       | Nilai           |
| ---------------- | --------------- |
| Framework        | Vite            |
| Root Directory   | `.`             |
| Build Command    | `npm run build` |
| Output Directory | `dist`          |
| Install Command  | `npm install`   |

`vercel.json` mengarahkan semua route aplikasi ke `index.html`. Pengaturan ini
membuat halaman seperti `/login`, `/dashboard`, dan `/riwayat` tetap dapat dibuka
langsung atau di-refresh.

## Environment variable

Frontend membutuhkan dua nilai berikut:

```env
VITE_SUPABASE_URL=https://project.supabase.co
VITE_SUPABASE_ANON_KEY=public-key
```

Keduanya digunakan oleh browser dan harus dipasang pada environment Vercel yang
dibutuhkan. Nilai lokal disimpan di `.env`, sedangkan `.env.example` hanya menjadi
contoh nama variabel. File `.env` tidak boleh dimasukkan ke Git.

Fitur reset password langsung membutuhkan konfigurasi server tambahan:

```env
SUPABASE_SERVICE_ROLE_KEY=server-secret-key
ALLOW_EMAIL_ONLY_PASSWORD_RESET=true
```

`SUPABASE_SERVICE_ROLE_KEY` hanya boleh tersedia pada server Vercel. Jangan beri
awalan `VITE_`, jangan simpan di source code, dan jangan kirim nilainya melalui
chat atau screenshot.

Reset password saat ini tidak mengirim tautan verifikasi. Seseorang yang mengetahui
alamat email akun dapat mengganti password melalui form tersebut. Jika website
dipakai di luar kebutuhan demo, sebaiknya ganti alur ini dengan verifikasi email
atau kode OTP.

## Deployment otomatis

Push ke branch `main` akan menjalankan workflow
`.github/workflows/deploy-vercel.yml`. Workflow tersebut memasang dependency,
mengambil konfigurasi production, melakukan build, lalu mengirim hasilnya ke
Vercel.

Workflow membutuhkan repository secret bernama `VERCEL_TOKEN`. Token dibuat dari
akun Vercel yang mempunyai akses ke workspace `iszz100s-projects`. Simpan token di
GitHub melalui **Settings → Secrets and variables → Actions**.

Sebelum push, jalankan pemeriksaan lokal:

```bash
PLAYWRIGHT_CHROME_CHANNEL=chrome npm run check
```

Push yang berhasil masuk GitHub belum selalu berarti deployment berhasil. Periksa
tab **Actions** dan pastikan job selesai tanpa error.

## Deployment manual

Jika workflow sedang bermasalah, deployment dapat dilakukan dari folder project:

```bash
npm ci
npm run check
npx vercel deploy --prod --yes --scope iszz100s-projects
```

Pada komputer baru, hubungkan folder ke project yang sudah ada:

```bash
npx vercel login
npx vercel link --yes --project jasida --scope iszz100s-projects
```

Vercel akan membuat `.vercel/project.json` untuk menyimpan hubungan folder dengan
project. Folder `.vercel` bersifat lokal dan tidak masuk Git.

## Penyimpanan foto laporan

Sebelum dikirim, foto diubah menjadi WebP dengan ukuran maksimal 99.999 byte.
Bucket Supabase `report-images` perlu memakai batas yang sama:

- Allowed MIME types: `image/webp`
- File size limit: `99999`

Konfigurasi bucket dapat diperiksa dan diperbarui dengan:

```bash
npm run storage:configure
```

Script akan meminta service-role key melalui input terminal dan tidak menyimpannya
ke file. Script hanya memperbarui batas upload bucket; foto lama dan access policy
tidak ikut diubah.

## Jika deployment bermasalah

Periksa beberapa hal berikut:

1. Jalankan `npm run check` dan selesaikan error yang muncul.
2. Pastikan seluruh environment variable tersedia di Vercel.
3. Periksa masa berlaku dan akses `VERCEL_TOKEN`.
4. Lihat log build pada halaman deployment Vercel.
5. Pastikan domain `www.jasida.web.id` masih mengarah ke deployment production.

Setelah environment variable diubah, lakukan deployment ulang agar nilai baru
digunakan oleh aplikasi.
