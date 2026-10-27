# Material pricing refinement — 26 Oktober 2026

## Git dan ruang lingkup

- Repository origin: https://github.com/pekoponn/Jasida.git
- Working tree bersih sebelum sinkronisasi.
- `git fetch origin --prune`, `git switch main`, `git pull --ff-only origin main` berhasil.
- HEAD setelah pull = origin/main = `361121864f2b7cdc2038f03e5ce82a13130178a6`.
- Branch implementasi: `feat/material-pricing-refinement`.
- Tidak push, deploy, atau mengubah database production.

## Implementasi

- `src/ai/materialEstimate.js`: empat kelas YOLO dipetakan ke keluarga metode perbaikan; jumlah/harga tidak diisi dari angka asumsi. Admin memverifikasi metode. Retak memanjang/melintang menyarankan sealant, retak buaya perlu pemeriksaan lapisan, lubang menyarankan tambal lokal. Saran ini bukan desain teknis final.
- `src/components/MaterialEditor.jsx`, `src/styles/materialPricing.css`: tabel semantik dengan kolom sejajar dan scroll horizontal, kategori material/tenaga/alat/lainnya, tambah/hapus/edit item, spesifikasi, satuan, pajak, pemilihan sumber, ukuran dan koefisien terdokumentasi.
- `src/pages/AdminKelolaLaporanPage.jsx`: modal mulai/selesai mempertahankan pemilih foto terbaru; estimasi disimpan sebelum pekerjaan. Jumlah dan harga realisasi wajib diisi ulang dari bukti, bukan disalin otomatis dari estimasi. Tidak ada fallback yang menulis estimasi ketika selesai.
- `src/lib/reports.js`: simpan metadata estimasi dan bukti realisasi terpisah. Tidak mengubah model YOLO, geofence, autentikasi, notifikasi atau verifikasi lokasi.
- `src/lib/materialPricing.js`: pencocokan harga ketat, konversi dimensional, deviasi, WAPE/MAE, seleksi pasangan, dan komposisi material.
- `src/lib/priceCatalog.js`, `src/components/PriceReferenceCatalog.jsx`: input/import JSON katalog admin, validasi sebelum upsert, pratinjau seed resmi. Import 1–200 item, maksimal 1 MB. Kode/tahun sama memperbarui katalog; snapshot harga pada estimasi tersimpan tidak ditulis ulang.
- `src/components/MaterialCostAnalysis.jsx`, `src/pages/AdminStatistikPage.jsx`: Chart A grouped bar harga per satuan, B bar horizontal deviasi, C biaya bulanan pasangan valid berdasarkan bulan penyelesaian, D donut material tersimpan. Kumpulan harga A/B dipilih per laporan untuk menghindari pencampuran spesifikasi atau rata-rata yang tidak bermakna.
- `src/data/official-material-prices.json`: dua kandidat import yang telah dicocokkan dengan lampiran resmi. Tidak otomatis dimasukkan ke database.
- `supabase/migrations/20261026_material_pricing.sql`: tabel katalog, RLS admin, metadata estimasi/realisasi, waktu estimasi dari server, penguncian estimasi historis.
- `tests/server/material-pricing.test.js`, `tests/e2e/material-pricing.spec.js`, `tests/e2e/fixtures.js`: unit dan regresi UI dengan data simulasi khusus tes.
- `src/components/LocationPicker.jsx`: membatalkan timer resize dan mengabaikan hasil pengecekan jalan yang sudah kedaluwarsa setelah modal dilepas; mencegah error Leaflet saat konfirmasi cepat.
- `package.json`, `package-lock.json`, `tests/database/material-pricing.mjs`: PGlite sebagai dev dependency untuk menguji SQL/RLS tanpa server production; `test:database` dimasukkan ke `check`.
- `playwright.config.js`: pengujian material pricing juga dijalankan terhadap build preview. Tes alur lama disesuaikan dengan pendaftaran Google, konfirmasi pin galeri dan label bukti foto dari commit terbaru.
- File lain yang berubah sebagian besar hanya dinormalisasi dengan Prettier karena commit upstream gagal `format:check`; import tidak terpakai di AdminSidebar dan komentar eslint tidak berlaku di LocationPicker dibersihkan. Tidak ada redesign landing page.

## Sumber dan harga yang diverifikasi

Sumber resmi: [Perbup Sidoarjo 27/2025, lampiran SHS TA 2026](https://adminweb.sidoarjokab.go.id/upload/files/1751631865-Peraturan%20Bupati%20Nomor%2027%20Tahun%202025.pdf).

| Material | Spesifikasi | Kode barang | Satuan | Harga |
|---|---|---|---|---|
| Semen Portland | SNI | 1.1.12.01.01.0001.00191 | kg | Rp1.960 |
| Agregat Halus / Pasir Beton | sesuai SNI, Lolos ayakan No. 4 | 1.1.12.01.01.0001.00174 | m³ | Rp347.600 |

Keduanya terdapat di halaman PDF 8 (indeks 7). Pasal 3 pada halaman PDF 4 menyatakan SSH menggunakan harga tengah tiga survei sebelum PPN. Verifikasi dokumen: 26 Oktober 2026. Harga ini acuan anggaran, bukan bukti transaksi. Semen tidak otomatis ditambahkan pada pekerjaan retak aspal. Pasir beton tidak disamakan dengan agregat kasar.

[RDS](https://rds.sidoarjokab.go.id/) menyediakan kategori SSH/HSPK, tetapi tautan katalog dan kamus publik mengarahkan ulang ke beranda dalam akses sesi ini. Tidak menerobos login. Pencarian teks lampiran belum menemukan hotmix, tack coat, sealant yang cocok; tidak membuat harga resmi untuk item tersebut.

[SE DJBK 47/SE/Dk/2026 Lampiran V](https://binakonstruksi.pu.go.id/sdm_downloads/lampiran-v-se-djbk-no-47-se-dk-2026/) terkonfirmasi sebagai AHSP Bina Marga. Unduhan penuh tidak berhasil: pembaca web menolak ukuran 21,6 MB dan download langsung memberi 403. Karena itu tidak ada koefisien numerik AHSP bawaan yang diklaim terverifikasi. Admin memasukkan koefisien, kode analisis/halaman dan URL resmi PU, serta memverifikasi kesesuaiannya dengan metode. Validasi format/domain tidak menggantikan pemeriksaan isi dokumen.

## Rumus dan batasan evaluasi

- Luas = panjang × lebar, atau luas hasil pengukuran langsung.
- Volume = luas × ketebalan (semua dimensi dalam meter); pekerjaan retak dapat memakai panjang dalam meter.
- Jumlah bahan/tenaga/alat = volume pekerjaan × koefisien per satuan pekerjaan. Unit hasil mengikuti unit koefisien yang diverifikasi admin.
- Jumlah yang dikoreksi manual memerlukan catatan dasar koreksi. Perubahan dimensi/metode menghapus metadata kalkulasi lama.
- Subtotal = jumlah × harga satuan; total = jumlah seluruh subtotal. Data kosong bukan harga nol.
- Konversi harga berdasarkan satuan: ton ↔ kg ↔ g; m³ ↔ liter ↔ ml. Tidak mengonversi massa menjadi volume, atau sak menjadi kilogram, tanpa bukti.
- Deviasi = abs(estimasi − acuan) / acuan × 100; acuan harus positif.
- Kesesuaian terhadap Harga Acuan = max(0, 100 − deviasi). Sumber identik diberi keterangan bukan validasi independen.
- WAPE = Σabs(estimasi − aktual) / Σaktual × 100; Skor Kesesuaian Biaya = max(0, 100 − WAPE).
- MAE = Σabs(estimasi − aktual) / n. WAPE/score tidak terdefinisi bila Σaktual nol.
- Pasangan evaluasi harus satu ID, selesai, nilai valid, waktu estimasi sebelum selesai, dan realisasi terverifikasi. Rekaman lama tanpa provenance tidak di-backfill. Tidak memakai biaya aktual untuk melatih ulang estimasi historis.
- Donut hanya memasukkan kategori material; data lama tanpa kategori dikecualikan, jumlahnya ditampilkan. Data simulasi hanya di tes.

## Penerapan manual

1. Cadangkan dan tinjau skema database yang berjalan; migration ditujukan pada skema produksi yang sudah mempunyai `reports`, `profiles` (id/role), serta kolom biaya yang dipakai aplikasi saat ini. `supabase/schema.sql` lama bukan skema lengkap produksi.
2. Pastikan kebijakan `profiles` tidak mengizinkan pengguna biasa mengubah `role` sendiri; katalog mengandalkan role admin yang sudah digunakan aplikasi.
3. Jalankan migration `supabase/migrations/20261026_material_pricing.sql` melalui Supabase SQL Editor. Tidak menjalankan ulang schema.sql. Migration tidak menghapus data atau menambahkan timestamp fiktif pada laporan lama.
4. Admin membuka Statistik → Katalog harga acuan, meninjau dua referensi bawaan, lalu menyimpannya bila sesuai. Harga lain dapat diinput atau diimport JSON dengan seluruh metadata yang sama.
5. Uji satu alur mulai–selesai pada staging sebelum rilis. Tanpa migration, katalog menampilkan error yang jelas; penyimpanan metadata baru memerlukan migration.

Migration telah diuji secara terisolasi dengan PostgreSQL WASM (PGlite): dapat diterapkan dua kali, katalog hanya dapat dibaca/ditulis admin, legacy tetap tanpa timestamp, timestamp baru dibuat server, perubahan estimasi setelah mulai ditolak, dan penyelesaian terverifikasi memerlukan referensi bukti. Ini bukan pengujian terhadap RLS/skema production yang aktual.

## Pemeriksaan akhir

- `npm run check`: format, lint tanpa warning, build, 15 tes unit/server, tes database terisolasi, dan 72 tes browser (dev/preview) lulus.
- Setelah penyesuaian animasi grafik dan selector pemeriksaan lebar SVG, format/lint/build dijalankan ulang; 10 tes material pricing ulang pada dev dan preview seluruhnya lulus.
- Screenshot chart desktop dan mobile diperiksa secara visual. Data hotmix pada screenshot adalah fixture tes, bukan harga resmi atau data production.
- `git diff --check` lulus.
- Tes browser memakai backend simulasi; tidak mengklaim login admin/user atau pengujian RLS di production. Runtime browser interaktif tidak tersedia pada sesi ini.
- Persentase akurasi lapangan belum dapat dinyatakan tanpa pasangan estimasi sebelum selesai dan realisasi independen yang valid. Harga resmi hotmix/tack coat/sealant dan koefisien AHSP numerik tetap perlu dokumen terverifikasi dari admin.
- Build berhasil. Tidak dilakukan perubahan arsitektur/bundling di luar ruang lingkup tugas.

## Inventaris file

Daftar lengkap file yang ditambah/diubah (termasuk perapian format upstream):

- `README.md`
- `docs/material-pricing-refinement.md`
- `package-lock.json`
- `package.json`
- `playwright.config.js`
- `src/ai/materialEstimate.js`
- `src/components/AdminSidebar.jsx`
- `src/components/AdminTopbar.jsx`
- `src/components/LocationPicker.jsx`
- `src/components/MaterialCostAnalysis.jsx`
- `src/components/MaterialEditor.jsx`
- `src/components/Navbar.jsx`
- `src/components/NotificationPanel.jsx`
- `src/components/PriceReferenceCatalog.jsx`
- `src/data/official-material-prices.json`
- `src/features/report-upload/ContextPhotoField.jsx`
- `src/lib/AuthContext.jsx`
- `src/lib/exifLocation.js`
- `src/lib/locationTrust.js`
- `src/lib/mapLinks.js`
- `src/lib/materialPricing.js`
- `src/lib/notifications.js`
- `src/lib/priceCatalog.js`
- `src/lib/reports.js`
- `src/lib/roadCheck.js`
- `src/lib/useNotifications.js`
- `src/pages/AdminKelolaLaporanPage.jsx`
- `src/pages/AdminStatistikPage.jsx`
- `src/pages/AdminVerifikasiLokasiPage.jsx`
- `src/pages/AdminVerifikasiPage.jsx`
- `src/pages/DashboardPage.jsx`
- `src/pages/LandingPage.jsx`
- `src/pages/LoginPage.jsx`
- `src/pages/ReportPage.jsx`
- `src/styles/materialPricing.css`
- `supabase/migrations/20261026_material_pricing.sql`
- `tests/admin-data.browser.js`
- `tests/database/material-pricing.mjs`
- `tests/e2e/fixtures.js`
- `tests/e2e/flows.spec.js`
- `tests/e2e/material-pricing.spec.js`
- `tests/e2e/multi-photo.spec.js`
- `tests/image-upload.browser.js`
- `tests/server/material-pricing.test.js`

## Audit keamanan lanjutan

Perbaikan guard INSERT, transisi selesai, privilege dan hasil regresi tanggal 27 Oktober 2026 tersedia di [laporan audit keamanan](material-pricing-security-audit.md). Gunakan laporan tersebut bersama pemeriksaan skema production sebelum menerapkan migration; hasil PGlite bukan sertifikasi keamanan production.
