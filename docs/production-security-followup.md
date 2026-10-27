# Production security follow-up — 27 Oktober 2026

## Status dan batasan

Pekerjaan dilanjutkan dari `cca17773a44e3a9a65dc7c23e547695a6d866e54` pada branch `feat/material-pricing-refinement`, sesudah fetch dan pull ff-only. PR #1 terverifikasi open dan Draft. Tidak ada perubahan ke database, migration runner, deployment, atau merge.

Pengguna melaporkan perbaikan manual `is_admin()`/`is_admin(uuid)` dan `notify_admins(...)` (search_path pg_catalog), pencabutan EXECUTE langsung notify_admins, serta UPDATE profil terbatas. Ini **laporan pengguna, belum hasil inspeksi database sesi ini**. Tidak tersedia konektor SQL production atau dump lengkap; pengguna menyatakan akan mengirim hasil audit. Definisi aktual wajib diterima sebelum mengganti fungsi/policy tersebut. Migration pricing lama tidak diedit.

## Yang diimplementasikan

- `supabase/migrations/20261027_profile_role_security.sql`: migration baru, terpisah dari pricing. Prasyarat schema/type diperiksa sebelum perubahan; transaksi gagal jika tidak cocok. Tidak mengubah data profil lama.
- `jasida_set_user_role(uuid,text)`: SECURITY DEFINER, search_path kosong, objek berkualifikasi skema. Memerlukan JWT pengguna admin, UUID target yang ada, dan role `user`/`admin` sesuai UI. Menolak perubahan role sendiri dan penghilangan admin terakhir. Mengunci tabel profiles sebelum memeriksa admin dan melakukan perubahan untuk menserialisasi mutasi role. Tidak memberikan bypass berdasarkan role string dalam payload.
- `profile_role_audit`: mencatat actor/target, role sebelum/sesudah, dan waktu server dalam transaksi yang sama; no-op tidak menambah catatan. Tidak dapat dibaca/ditulis klien, audit ditinjau operator database tepercaya.
- EXECUTE RPC hanya untuk authenticated; PUBLIC/anon/service_role dicabut. Identitas admin tetap diverifikasi di badan fungsi. Pemilik fungsi harus role database tepercaya dengan akses bypass RLS yang diaudit.
- Cabut table-level dan column-level UPDATE/INSERT profil lama dari PUBLIC/anon/authenticated. Cabut DELETE klien. Grant UPDATE hanya username/full_name/avatar_url. Restrictive RLS membatasi update profil ke ID sendiri tanpa memperluas policy permissive yang ada. Pembuatan profil harus melalui trigger Auth tepercaya yang **masih harus diperiksa**. Hak service/backend yang sudah ada dan inheritance role lain tetap perlu audit.
- `src/lib/profile.js` dan `AdminPenggunaPage.jsx`: perubahan role melalui RPC, UI memakai hasil server; penolakan tidak mengubah role tampilan. Edit profil dan avatar tetap memakai kolom yang diizinkan.
- `supabase/audit-production-security.sql`: ekspor metadata read-only untuk fungsi SECURITY DEFINER, signature/owner/ACL/search_path, trigger public/auth/storage, view, constraints, tipe/default kolom, policy, table/column grants, role inheritance, bucket dan keberadaan migration ledger. Tidak mengambil baris profil/laporan/notifikasi/objek pengguna.
- Tes SQL baru masuk `npm run test:database`; tes browser admin-role dan notifikasi masuk dev dan preview. Fitur material pricing dan seluruh migration histori sebelumnya dipertahankan.

## Audit penggunaan aplikasi dan pekerjaan yang diblokir skema

| Area | Bukti dari repository | Keputusan sebelum menerima dump |
|---|---|---|
| Role | Hanya user/admin dipakai UI; sebelumnya profiles UPDATE role langsung | RPC + privilege + tes diimplementasikan, belum diterapkan |
| INSERT laporan | createReport INSERT tanpa user_id/status; bergantung default/trigger production. Sengketa melalui create_disputed_report | Periksa default/trigger/RPC, lalu batasi autentikasi/owner/status. Jangan mengasumsikan schema.sql lama lengkap |
| UPDATE laporan | Pemilik menautkan image_path setelah upload. Admin mengubah status/biaya/lokasi. support_report/add_reporter dapat melakukan update melalui RPC | Jangan menghapus UPDATE pemilik atau memasang guard semua kolom tanpa mengetahui RPC, karena dapat merusak upload dan dukungan |
| SELECT/peta | reports_with_coords SELECT * dipakai peta/feed/riwayat/admin. Feed mengambil rejection_reason dan identitas profil; status tertahan difilter di klien | Definisi view/security_invoker/owner belum ada. Filter klien bukan proteksi. View publik kolom terbatas dan pemisahan own/admin query wajib didesain dari schema nyata sebelum mengubah SELECT grants |
| Foto | Path saat ini reportId/uuid-file.webp. Bukti dukungan dapat ditambahkan ke laporan orang lain; report_photos menyimpan uploader user_id | Verifikasi policy support/member dan object ownership; jangan menganggap semua uploader harus pemilik laporan. Tidak mengubah namespace path atau bucket visibility tanpa rencana kompatibilitas |
| Storage | URL melalui getPublicUrl; schema lama membuat bucket public. Klien mengonversi WebP <=99.999 bytes; script konfigurasi bucket ada tetapi tidak dijalankan | MIME/size client bukan batas server. Periksa konfigurasi nyata; rencanakan policy path/owner/membership dan link validation. Foto lama tidak dihapus/dipindah |
| Notifikasi | Frontend hanya membaca/menandai notifications dan subscribe realtime. Tidak ada panggilan langsung notify_admins/reports_notify | Jangan mengubah EXECUTE/search_path tanpa badan reports_notify dan owner. Tes UI bukan bukti trigger tetap bisa memanggil helper yang EXECUTE-nya dicabut |
| Manual SQL | is_admin overloads dan notify_admins dilaporkan sudah diperketat | Rekonsiliasi ke migration lanjutan menunggu definisi aktual. Mengganti search_path saja pada body tak dikenal dapat memutus nama objek tanpa skema |

**Belum diselesaikan:** RLS reports/Storage production, view publik yang membatasi paparan kolom, validasi penautan objek foto, hardening ulang seluruh RPC/trigger lama, dan rekonsiliasi SQL manual fungsi admin/notifikasi. Tidak dibuat migration spekulatif untuk area tersebut. Snapshot lama `schema.sql` memakai report_images, sedangkan aplikasi memakai report_photos; reports_with_coords dan RPC terbaru tidak didefinisikan di repo. Ini ketidaksesuaian nyata, bukan alasan untuk menerapkan schema lama.

## Pengujian

- SQL PGlite menguji anon, JWT kosong, non-admin, admin, role sendiri, target kosong/tidak valid/tidak ada, role tidak valid, admin terakhir, caller yang telah didemote, pencabutan UPDATE/INSERT/DELETE langsung, self-edit normal, cross-user edit, audit atomik/no-op, ACL/search_path dan penerapan dua kali.
- Lock serialisasi diperiksa, tetapi tidak diklaim sebagai tes concurrency multi-session PostgreSQL nyata.
- Query audit dieksekusi dalam transaksi READ ONLY pada schema sintetis untuk memeriksa sintaks dan tidak adanya penulisan.
- Browser menguji pemanggilan RPC role, self-selector disabled, error server tetap mempertahankan role, serta notifikasi user/admin dan penandaan dibaca tanpa RPC notify_admins langsung.
- Tes notifikasi awal mengalami race navigasi login: tes mengklik menu sebelum redirect admin selesai. Menunggu URL saja belum cukup karena route memakai lazy/Suspense; tes sekarang menunggu heading halaman tujuan sebelum berinteraksi; assertion tidak diturunkan.
- `npm run check` lulus: format, lint, build, 15 unit/server, seluruh tes SQL histori biaya dan role, pemeriksaan audit dalam READ ONLY, serta 78/78 browser dev/preview (4,7 menit). Mock/PGlite tidak memverifikasi Supabase production.

## Urutan manual minimum — jangan jalankan runner sekarang

1. Dengan prosedur audit read-only yang disetujui, jalankan `audit-production-security.sql`; kirim hasil metadata. Jika migration ledger ada, ambil `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version` secara terpisah. Jangan sertakan key/kredensial bila ditemukan literal sensitif pada body fungsi.
2. Rekonsiliasi schema hasil ekspor dengan kode; periksa trigger pembuatan profiles, policy self-edit permissive, RLS/owner fungsi, tipe id/role, serta inheritance grants. Snapshot manual SQL belum membuktikan migration ledger sesuai. **Jangan gunakan db push/migration repair.**
3. Setelah review tersebut, uji migration role **secara spesifik** di staging. Migration role independen dan tidak memerlukan pricing: jangan otomatis menjalankan 20261026 hanya karena timestamp lebih lama. Uji edit profil, kenaikan/penurunan role, self/last-admin denial, serta dua transaksi role bersamaan. Penerapan role harus mendahului rilis frontend yang memanggil RPC baru.
4. Susun dan review migration lanjutan reports/Storage/notifikasi dari hasil audit. Urutan relatif terhadap pricing harus diputuskan setelah melihat trigger/RPC aktual, bukan ditentukan secara spekulatif sekarang.
5. Tinjau dan terapkan migration pricing pending hanya bila memang diperlukan/dipersiapkan pada environment tersebut. Tidak mengedit migration yang mungkin sudah diterapkan, tidak backfill timestamp/provenance palsu, tidak mengubah ledger untuk menutupi perbedaan.
6. Jalankan smoke test Supabase staging nyata untuk profil, role, laporan/sengketa/dukungan, foto dan notifikasi, admin accept/start/complete, serta statistik. Setelah semua blocker hilang dan ada persetujuan eksplisit, jadwalkan langkah production terpisah. Saat ini belum ada dasar untuk menyatakan siap rilis.

## File perubahan sesi ini

`src/lib/profile.js`, `src/pages/AdminPenggunaPage.jsx`, migration role baru, SQL audit production baru, `tests/database/profile-role-security.mjs`, `tests/e2e/profile-security.spec.js`, fixture browser, `playwright.config.js`, `package.json`, dan dokumen ini. Tidak ada perubahan kebijakan production yang tersembunyi di tooling atau deployment.
