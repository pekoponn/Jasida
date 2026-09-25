# Jasida — Jaga Sidoarjo

Jasida adalah aplikasi pelaporan kerusakan jalan untuk wilayah Sidoarjo. Pengguna
bisa mengambil foto dari kamera atau galeri, mengirim lokasi, lalu melihat perkembangan
laporannya. Admin dapat memeriksa laporan, mengubah status, dan mengelola data dari
dashboard.

Website yang sedang aktif: [www.jasida.web.id](https://www.jasida.web.id/)

## Fitur utama

- Login dan pendaftaran akun pengguna.
- Foto dari kamera atau galeri, maksimal 5 foto dalam satu laporan.
- Pratinjau, ambil ulang, dan hapus foto sebelum analisis AI.
- Pemeriksaan lokasi untuk laporan wilayah Sidoarjo.
- Mode uji coba agar alur laporan tetap dapat didemokan dari luar Sidoarjo.
- Deteksi kerusakan jalan dengan model YOLO yang berjalan di browser.
- Perhitungan tingkat bahaya berdasarkan hasil deteksi.
- Riwayat dan detail perkembangan laporan.
- Dashboard admin untuk memeriksa serta memperbarui status laporan.
- Reset password menggunakan email yang sudah terdaftar.

## Teknologi yang dipakai

| Bagian                   | Teknologi                     |
| ------------------------ | ----------------------------- |
| Tampilan                 | React + Vite                  |
| Database dan autentikasi | Supabase                      |
| Peta                     | Leaflet + OpenStreetMap       |
| Model AI                 | ONNX Runtime Web              |
| Hosting                  | Vercel                        |
| Pengujian                | Playwright + Node Test Runner |

Model AI dijalankan di browser pengguna, jadi aplikasi tidak memerlukan server GPU.

## Menjalankan project di komputer

Pastikan Node.js versi 22.12 atau yang lebih baru sudah terpasang. Setelah repo
di-clone, jalankan:

```bash
npm ci
cp .env.example .env
npm run dev
```

Isi `.env` dengan URL dan public key Supabase yang digunakan project:

```env
VITE_SUPABASE_URL=https://project.supabase.co
VITE_SUPABASE_ANON_KEY=public-key
```

Setelah server berjalan, buka `http://localhost:5173`.

Kamera dan GPS hanya tersedia pada koneksi aman. Keduanya dapat dipakai melalui
HTTPS atau `localhost`. Jika website dibuka dari HP melalui alamat IP komputer,
gunakan HTTPS agar browser tidak memblokir izin perangkat.

## Perintah yang sering dipakai

| Perintah              | Kegunaan                                                     |
| --------------------- | ------------------------------------------------------------ |
| `npm run dev`         | Menjalankan website untuk pengembangan                       |
| `npm run build`       | Membuat build production di folder `dist`                    |
| `npm run format`      | Merapikan format kode dengan Prettier                        |
| `npm run lint`        | Memeriksa masalah pada kode                                  |
| `npm run test:server` | Menjalankan tes endpoint server                              |
| `npm test`            | Menjalankan tes browser                                      |
| `npm run check`       | Menjalankan pemeriksaan format, lint, build, dan seluruh tes |

Jika Playwright belum mempunyai browser pengujian, pasang dengan:

```bash
npx playwright install chromium
```

Chrome yang sudah terpasang di komputer juga dapat digunakan:

```bash
PLAYWRIGHT_CHROME_CHANNEL=chrome npm test
```

Tes memakai backend, kamera, dan GPS simulasi. Tes tersebut tidak menulis data ke
database production. Folder `dist`, `dist-test`, `test-results`, dan
`playwright-report` hanya berisi hasil build atau pengujian dan tidak masuk Git.

## Cara laporan diproses

1. Pengguna masuk dan membuka halaman laporan.
2. Pengguna mengambil foto dari kamera atau memilih beberapa foto dari galeri.
3. Pengguna memeriksa pratinjau dan bisa mengambil ulang atau menghapus foto yang kurang jelas.
4. Setelah tombol **Analisis Foto** ditekan, YOLO memeriksa setiap foto. Masing-masing foto sudah dikecilkan menjadi WebP di bawah 100 KB.
5. Aplikasi menampilkan hasil tiap foto dan menghitung skor gabungan dari nilai tengah foto yang menunjukkan kerusakan.
6. Lokasi dan jenis kerusakan dibandingkan dengan laporan yang sudah ada.
7. Setelah pengguna mengirim laporan, foto utama dan seluruh foto pendukung disimpan di Supabase. Petugas bisa membukanya melalui **Lihat Semua Foto**.

Gunakan 2–3 sudut dari kerusakan yang sama, misalnya tampak dekat, samping, dan lingkungan sekitarnya.
Beberapa foto membantu petugas memeriksa bukti, tetapi tidak menjamin AI selalu benar.
Skor tiap sudut tidak dijumlahkan agar kerusakan yang sama tidak terhitung berulang.
Jika hasil antar foto berbeda, aplikasi menampilkan keterangannya untuk ditinjau kembali.

Jika analisis gagal atau tidak ada kerusakan yang terdeteksi di seluruh foto, laporan tidak
bisa dikirim. Pada mode laporan biasa, lokasi juga harus berada di wilayah
Sidoarjo. Mode uji coba tetap memerlukan GPS, tetapi dapat digunakan dari daerah
lain untuk kebutuhan demonstrasi.

Lokasi foto galeri tetap mengikuti GPS perangkat saat laporan dibuat, bukan metadata foto.
Pastikan kamu berada di lokasi kerusakan dan memilih foto yang terbaru. GPS tetap membutuhkan izin meski kamera tidak dipakai.
Jika sebagian unggahan gagal, kirim ulang dari halaman yang sama untuk melanjutkan foto yang belum tersimpan.
Selama unggahan belum lengkap, jangan tutup halaman: progres percobaan ulang masih disimpan di memori tab.

## Struktur folder

```text
api/                    endpoint Vercel
public/models/          model ONNX yang digunakan browser
scripts/                script bantuan untuk konfigurasi project
server/                 logika endpoint yang dapat diuji terpisah
src/ai/                 preprocessing dan perhitungan hasil AI
src/components/         komponen tampilan yang dipakai ulang
src/features/           alur kamera dan pemeriksaan laporan ganda
src/lib/                akses Supabase serta fungsi pendukung
src/pages/              halaman pengguna dan admin
supabase/               skema awal dan query pemeriksaan database
tests/                  tes browser, server, dan fixture
```

`supabase/schema.sql` adalah skema awal untuk project baru. File tersebut bukan
migration untuk database yang sedang aktif, jadi jangan menjalankannya kembali ke
database production tanpa memeriksa isinya terlebih dahulu.

## Model AI

Model aktif berada di `public/models/yolo-damage.onnx`. Model menerima gambar
`960 × 960` dan mengenali empat kelas berikut:

- `pothole`
- `alligator_crack`
- `longitudinal_crack`
- `transverse_crack`

Urutan kelas pada model harus sama dengan `DAMAGE_CLASSES` di `src/ai/yolo.js`.
Jika model diganti, periksa kembali ukuran input, bentuk output, urutan kelas, dan
hasil preprocessing sebelum deployment.

Encoder CLIP belum disertakan. Untuk saat ini, saran laporan ganda memakai jenis
kerusakan dan jarak maksimal 50 meter. Hasilnya hanya ditampilkan sebagai saran
dan tetap memerlukan keputusan pengguna.

## Deployment

Panduan environment variable, deployment Vercel, dan konfigurasi penyimpanan ada
di [DEPLOYMENT.md](DEPLOYMENT.md).
