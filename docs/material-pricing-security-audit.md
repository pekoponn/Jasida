# Audit keamanan material pricing — 27 Oktober 2026

## Ruang lingkup dan Git

Branch `feat/material-pricing-refinement`, HEAD `361121864f2b7cdc2038f03e5ce82a13130178a6`. Working tree berisi implementasi refinement sebelumnya; seluruh perubahan dipertahankan. Tidak reset, pull yang menimpa pekerjaan, push, deploy, atau koneksi/migration ke database production. Migration lama belum diterapkan menurut sesi sebelumnya, sehingga file yang sama diperbaiki. Bila ternyata pernah diterapkan di lingkungan lain, gunakan migration lanjutan yang ditinjau terlebih dahulu, jangan mengandalkan runner menjalankan ulang nama file yang sudah tercatat.

## Temuan dan perbaikan

| Risiko | Perbaikan |
|---|---|
| INSERT langsung kembali tanpa memeriksa status/biaya | Hanya `open` dan `pending_duplicate_review` diterima. Semua kolom estimasi, realisasi, bukti, dan timestamp keuangan dinormalisasi kosong; verifikasi false. Berlaku juga bagi INSERT admin/backend, tanpa bypass tersembunyi. |
| Selesai dapat dibuka ulang dan status bertentangan dengan timestamp | Baris dengan status `resolved` **atau** `resolved_at` terisi tidak dapat berganti status. `in_progress` hanya dari `accepted`, `resolved` hanya dari `in_progress`; pengerjaan berjalan tidak dapat mundur melalui UPDATE biasa. |
| Waktu selesai bisa diisi klien pada UPDATE yang bukan penyelesaian | Trigger mengabaikan timestamp klien, mempertahankan nilai lama, dan membuat waktu server hanya pada transisi sah. Payload/UI menggunakan hasil server. |
| Kolom teks `actual_materials` lolos penguncian | Semua kolom realisasi, termasuk teks, JSON, biaya, verifikasi dan referensi bukti dilindungi bersama. |
| Verifikasi dapat ditulis sebelum penyelesaian; NaN/Infinity belum ditolak | Realisasi hanya dicatat saat penyelesaian. Biaya terverifikasi harus finite, nonnegatif, dan memiliki referensi bukti tidak kosong. Estimasi saat mulai juga harus finite/nonnegatif. |
| Fungsi bergantung pada search_path public / EXECUTE default PUBLIC | Kedua fungsi menggunakan `SET search_path = ''`; tabel, fungsi auth dan fungsi waktu memiliki nama skema lengkap. Hak eksekusi dan akses katalog dibatasi eksplisit. |

Laporan selesai tanpa verifikasi tetap boleh ada dan tidak masuk evaluasi. UI normal mensyaratkan verifikasi dan foto bukti, lalu memberi keterangan bahwa hasil dikunci. Tidak ada kebutuhan membuka kembali pada UI yang ditemukan; **tidak dibuat jalur koreksi/bypass baru**. Koreksi data lama membutuhkan rancangan workflow admin terpisah dengan audit trail sebelum diimplementasikan, bukan UPDATE biasa. Data historis yang sudah tidak konsisten tidak otomatis diperbaiki; audit read-only mengidentifikasinya. Perubahan kolom lain pada baris historis tidak menciptakan timestamp baru.

## Audit aplikasi, RLS dan RPC

`createReport()` melakukan INSERT langsung dan tidak mengirim status; `supabase/schema.sql` menetapkan default `open`. UI admin hanya menawarkan mulai pada `accepted` dan selesai pada `in_progress`. `createDisputedReport()` memanggil RPC `create_disputed_report`; UI mengenal `pending_duplicate_review` sebagai status tunggu sengketa.

**Definisi RPC pembuatan sengketa, resolusi duplikat, serta kebijakan production tidak tersedia di repo.** `schema.sql` adalah skema lama dengan INSERT `WITH CHECK (true)`, bahkan untuk anon, dan tidak merepresentasikan seluruh kolom/alur terbaru. Audit ini tidak mengubah kebijakan reports/profiles secara spekulatif. Trigger menjadi lapisan pertahanan terhadap penulisan biaya walaupun kebijakan baris terlalu permisif; trigger bukan pengganti ownership RLS, perlindungan role, atau validasi foto bukti. Tes memasang RLS sintetis dengan update own-row yang sengaja permisif agar pertahanan trigger benar-benar diuji.

`jasida_pricing_admin()` memakai `auth.uid()` dan `public.profiles.role`. Keamanan bergantung pada larangan pengguna mengubah role sendiri, keamanan JWT, dan pemilik fungsi yang tepercaya. RPC SECURITY DEFINER tetap membawa identitas JWT pemanggil; tidak diberi bypass berdasarkan current_user/session_user. Tidak ada kebutuhan aplikasi yang ditemukan untuk service_role menulis biaya; bila backend semacam itu ada di production, perlu audit jalur eksplisit sebelum penerapan.

## Privilege akhir migration

| Objek | authenticated | anon / service_role / PUBLIC |
|---|---|---|
| `jasida_pricing_admin()` | EXECUTE, dibutuhkan RLS dan trigger saat UPDATE | EXECUTE dicabut |
| `jasida_guard_cost_history()` | EXECUTE langsung dicabut; dijalankan sebagai trigger | EXECUTE langsung dicabut |
| `material_price_references` | SELECT/INSERT/UPDATE dengan RLS admin; tanpa DELETE | Hak tabel dicabut |

Guard tetap SECURITY INVOKER. Helper admin SECURITY DEFINER hanya membaca role dan memakai search_path kosong. Trigger dibuat oleh pemilik migration; pencabutan EXECUTE klien tidak mencegah pemanggilan trigger saat DML, terbukti pada pengujian terisolasi. Service role tidak memperoleh jalur bypass biaya dari migration ini. Pemilik/superuser database tetap merupakan trust boundary yang dapat mengubah trigger atau privilege; hal itu tidak bisa dicegah oleh trigger sendiri. Periksa privilege yang diwariskan dari role lain pada deployment nyata.

## Semantik katalog

Tidak ada perubahan harga/koefisien. `compareMaterial()` dan pilihan harga editor membatasi pembanding material ke SSH dengan spesifikasi, satuan, tahun, pajak, URL resmi dan status verifikasi cocok. HSPK tetap dapat disimpan sebagai harga pekerjaan dan dikecualikan dari chart material. AHSP merupakan rujukan koefisien terpisah. Tes unit memastikan HSPK tidak menjadi pembanding material. Verifikasi admin berarti meninjau isi sumber; URL resmi dan referensi bukti berbentuk teks bukan pembuktian independen otomatis.

## Pengujian lokal

Sepuluh kelompok regresi SQL/RLS PGlite lulus:

1. INSERT normal `open` dan status tunggu sengketa berhasil.
2. INSERT status selesai/berjalan/diterima/ditolak ditolak; seluruh provenance biaya palsu dinormalisasi.
3. Non-admin tidak dapat mengubah estimasi, realisasi, verifikasi, atau status.
4. Mulai hanya dari accepted; estimasi valid terkunci setelah mulai.
5. Timestamp estimasi dibuat server; perubahan timestamp klien diabaikan.
6. Laporan selesai, termasuk legacy tanpa timestamp, tidak dapat dibuka ulang; seluruh realisasi dan waktu selesai terkunci.
7. Realisasi terverifikasi memerlukan biaya finite/nonnegatif dan referensi bukti; penulisan sebelum penyelesaian ditolak.
8. Legacy tetap tanpa provenance; penyelesaian belum terverifikasi tidak masuk evaluasi dan tidak dapat diam-diam diverifikasi kemudian.
9. Katalog admin dapat dibaca/ditulis, user tidak melihat/mengubahnya, anon ditolak, DELETE tidak diberikan; EXECUTE dan search_path diperiksa.
10. Alur create → accept → start → verified complete berhasil; migration diterapkan dua kali tanpa merusak data.

- `npm run test:database`: 10 kelompok regresi di atas lulus (termasuk pemeriksaan tambahan hak service_role).
- `npm run test:server`: 15/15 lulus, termasuk pengecualian HSPK dan pasangan historis tanpa provenance.
- `npm run format:check`, `npm run lint`, `npm run build`: lulus.
- `npx playwright test tests/e2e/material-pricing.spec.js tests/e2e/modules.spec.js tests/e2e/flows.spec.js`: 52/52 lulus pada dev/preview (3,6 menit). Backend diintersepsi fixture, bukan production.
- `git diff --check`: lulus. Tidak ada push/deploy/migration production.

## Sebelum penerapan manual

Jalankan dan tinjau `supabase/audit-material-pricing.sql` secara read-only pada staging/production dengan akses resmi. Pastikan:

- Seluruh kolom aktual/estimasi, tipe numerik, default status, constraint, RLS/owner dan trigger lain cocok; tidak ada trigger berikutnya yang mengubah kembali nilai yang sudah dijaga.
- `profiles.role` tidak dapat dinaikkan sendiri oleh user melalui UPDATE, INSERT/upsert, RPC, atau jalur SECURITY DEFINER lain.
- RPC create sengketa menghasilkan status intake yang diizinkan, tidak memerlukan biaya saat INSERT, dan RPC duplikat/lokasi tidak mencoba membuka kembali laporan selesai.
- Helper dimiliki role tepercaya, `auth.uid()` tersedia, privilese efektif sesuai peran nyata, tanpa policy katalog lain yang memperluas akses.
- Periksa laporan legacy dengan status/timestamp bertentangan; jangan backfill palsu. Putuskan koreksi hanya melalui prosedur auditable yang dirancang terpisah.
- Periksa RLS `report_photos` dan Storage: referensi bukti pada reports dikunci, tetapi kebijakan perubahan/penghapusan berkas bukti production tidak tersedia di repo dan belum dibuktikan immutable oleh audit ini.
- Uji login, create report termasuk sengketa, accept/start/complete, foto bukti, notifikasi, serta RLS dengan identitas nyata pada staging.

**Lulus PGlite dan browser dengan backend simulasi tidak menyatakan migration aman untuk production.** Database production dan RPC-nya belum divalidasi dalam pekerjaan ini.

## File pada audit ini

- `supabase/migrations/20261026_material_pricing.sql`: guard INSERT/transisi/histori, validasi numerik, search_path dan privilege.
- `supabase/audit-material-pricing.sql`: introspeksi read-only untuk skema/RPC production.
- `tests/database/material-pricing.mjs`: sepuluh kelompok regresi dan pemeriksaan privilege/RLS.
- `src/lib/reports.js`: tidak mengirim resolved_at dari klien.
- `src/pages/AdminKelolaLaporanPage.jsx`: memakai timestamp respons server dan menjelaskan penguncian penyelesaian.
- `docs/material-pricing-security-audit.md`: laporan ini.
- `docs/material-pricing-refinement.md`: tautan ke audit terbaru.

## Pemeriksaan final sebelum commit/push

Pemeriksaan final juga menutup input timestamp `accepted_at`, `started_at`, dan `rejected_at`: INSERT mengosongkannya, UPDATE biasa mempertahankan histori, dan transisi status yang sah memakai waktu server. `started_at` identik dengan `estimate_recorded_at`. Timestamp penerimaan/penolakan merupakan waktu peristiwa; waktu penolakan lama tetap tersimpan bila laporan kemudian diterima. Tidak dilakukan backfill pada data lama. Klien memakai respons server. Tes SQL tambahan mencakup spoofing INSERT/UPDATE dan urutan penerimaan–mulai. Kolom timestamp tersebut wajib tersedia pada skema yang diaudit sebelum migration; SQL audit menambahkan pemeriksaan urutan dan policy Storage, tetap hanya SELECT.

Push branch fitur diotorisasi pada permintaan lanjutan; batasan tidak melakukan push pada catatan audit sebelumnya menggambarkan sesi tersebut. Push bukan persetujuan menjalankan migration atau deployment production.

Hasil final pada kode dengan pengamanan seluruh timestamp: `npm run check` lulus (format, lint, build, 15 unit/server, 10 kelompok regresi database + regresi timestamp tambahan, 72 browser / 4,6 menit). Perintah Playwright terpisah untuk material-pricing, modules, dan flows juga lulus 52/52 (3,3 menit). Pemindaian kandidat commit tidak menemukan token/kunci privat; `.env`, build, dan screenshot tes tidak disertakan. Workflow deployment repository hanya dipicu oleh main; tidak dipanggil dalam pekerjaan ini.
