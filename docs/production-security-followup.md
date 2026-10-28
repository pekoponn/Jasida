# Production security follow-up — 27 Oktober 2026

## Status terkini — 28 Oktober 2026

Pengguna sudah memberikan definisi `create_disputed_report`, kedua `is_admin`, `notify_admins`, kedua trigger reports, view `reports_with_coords`, dan policy tabel/Storage. Bagian di bawah mencatat progres sebelumnya; permintaan definisi tersebut sudah terpenuhi. Schema ekstensi, grants/view options, RPC dukungan/duplikat lainnya belum lengkap. Ledger `supabase_migrations.schema_migrations` dilaporkan tidak ada; ini tidak membuktikan migration belum pernah diterapkan manual.

Pengguna kini mengizinkan penerapan migration yang diperlukan, merge dan deployment. Hambatan saat ini adalah akses database: CLI Supabase tidak tersedia, tidak ada koneksi database/operator di konfigurasi sesi, dan hanya kunci publik aplikasi tersedia. Tidak menjalankan SQL perubahan atau memodifikasi ledger. Migration pricing dan role harus tersedia sebelum frontend baru dirilis.

Dua kandidat lanjutan dipertahankan di `supabase/drafts/*.sql.disabled`, di luar antrean migration. Kandidat akses Storage/view belum kompatibel dengan frontend saat ini dan belum diuji; jangan menerapkannya. Perubahan autentikasi createReport dan migration INSERT boundary memiliki tes tersendiri. Tidak ada data historis yang dikoreksi.

Pemeriksaan kompatibilitas REST tanpa membaca baris pengguna pada 28 Oktober: `material_price_references?select=id&limit=0` mengembalikan HTTP 404/PGRST205 (tabel tidak ada di schema cache); `reports?select=estimate_recorded_at,estimate_details,actual_cost_verified,actual_cost_evidence&limit=0` mengembalikan HTTP 400/42703 (estimate_recorded_at tidak ada). Fitur pricing belum dapat dinyatakan aktif. Pengguna kemudian mengizinkan deployment aplikasi tetap dilanjutkan dengan keterbatasan database ini dinyatakan secara eksplisit; tidak ada izin untuk mengklaim fitur pricing sudah berfungsi. Halaman production `/` dan `/login` merespons HTTP 200; pemeriksaan ini bukan smoke test browser ataupun bukti deployment baru.

Validasi lokal terbaru: `npm run check` selesai dengan exit 0 (format, lint, build, 15 tes server, suite SQL pricing/role/INSERT, 79 tes browser dev/preview). Draft `.sql.disabled` tidak termasuk cakupan tes. `git diff --check` bersih.

## Status dan batasan (catatan sebelumnya)

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

## Lanjutan berdasarkan ringkasan audit pengguna

Pengguna kemudian mengonfirmasi telah menjalankan audit read-only production dan memverifikasi: kedua overload is_admin memakai search_path pg_catalog; pemanggilan langsung notify_admins ditolak untuk anon/authenticated/service_role; authenticated hanya dapat UPDATE username/full_name/avatar_url. Policy reports INSERT publik/UPDATE sendiri dan Storage upload masih terlalu permisif. Trigger reports yang dilaporkan adalah reports_hold_manual_location dan reports_notify. Ada satu laporan in_progress dengan started_at lebih awal daripada accepted_at. Fakta tersebut diterima sebagai bukti yang dilaporkan pengguna; definisi lengkap dan output mentah belum diterima pada tahap ini. Tidak dilakukan koreksi terhadap laporan historis tersebut.

Perbaikan tambahan yang dapat ditinjau tanpa menebak body fungsi:

- `src/lib/reports.js`: createReport memverifikasi sesi dengan getUser, berhenti sebelum INSERT jika gagal/anon, dan mengirim user_id dari identitas tersebut. Parameter bebas tidak dapat memasukkan owner/status/biaya palsu ke payload.
- `20261027200000_reports_insert_boundary.sql`: migration baru dalam transaksi, dengan prasyarat user_id UUID dan status tersedia. Menambahkan **restrictive** INSERT policy untuk PUBLIC: JWT terautentikasi, user_id cocok, status open atau pending_duplicate_review sesuai alur aplikasi. Policy mengiriskan akses permissive yang sudah ada; tidak menambah grant atau allow-all baru. Dapat diterapkan ulang.
- Migration tidak menghapus policy SELECT/UPDATE, mengubah trigger/RPC, visibilitas bucket, atau data laporan. Status awal yang dihasilkan trigger manual-location/sengketa nyata tetap harus diperiksa sebelum staging. Jika berbeda, hentikan penerapan dan selaraskan rancangan dari definisi aktual.
- Policy ini **tidak** mengunci kolom biaya/provenance dan tidak menyelesaikan UPDATE/SELECT/Storage yang terlalu permisif. Owner tabel/BYPASSRLS/SECURITY DEFINER dapat melewati RLS: creation RPC tetap membutuhkan pemeriksaan internal sendiri. Guard biaya dari pricing tetap merupakan pekerjaan terpisah; jangan menyatakan policy INSERT ini telah menggantikannya.
- Tes SQL membuktikan penolakan anon, JWT kosong, owner palsu/null, status tidak sah/null; INSERT own open/pending berhasil; tanpa permissive policy tetap ditolak. Tes juga memverifikasi SELECT/image-link UPDATE tidak diganti, owner bypass tetap mungkin, dan fixture historis yang waktunya bertentangan tetap identik. Ini pengujian scope/batasan, bukan dukungan terhadap policy legacy yang terlalu luas.
- Tes browser module memverifikasi auth failure tidak menulis laporan, owner berasal dari sesi, dan field status/biaya yang tidak diterima tidak diteruskan.

### Informasi yang masih harus diterima sebelum rilis

1. Body lengkap, owner, SECURITY DEFINER/INVOKER, search_path dan ACL reports_hold_manual_location, reports_notify, notify_admins seluruh signature, is_admin kedua overload; urutan/timing/event trigger.
2. Definisi creation/sengketa/support/location/duplicate-review RPC, termasuk cara menentukan user_id, status awal, mutasi report_photos, serta helper yang dipanggil dari trigger. Tidak cukup hanya nama RPC atau search_path.
3. DDL/tipe/default/constraint reports, profiles, report_photos, report_supports; definisi reports_with_coords, owner dan opsi security_invoker. Ini menentukan apakah view membocorkan kolom privat melewati RLS.
4. Semua policy permissive/restrictive dan table/column grants efektif, termasuk role inheritance, untuk reports/profiles/report_photos/notifications/storage.objects. Definisi policy UPDATE diperlukan sebelum membatasi image_path, lokasi, status, dan finansial tanpa memutus RPC sah.
5. Konfigurasi bucket report-images, ownership kolom objek, kebutuhan foto dukungan lintas pemilik, keputusan publik/privat, dan kontrak path yang sudah dipakai. Existing URL memakai getPublicUrl; jangan menutup bucket atau memindahkan file tanpa rencana kompatibilitas.
6. Versi migration setiap environment dan SQL manual yang sudah diterapkan; konfirmasi apakah pricing/role migration ada di ledger atau hanya pernah dijalankan manual. Jangan repair ledger atau backfill historis secara otomatis.

Urutan rilis tetap diblokir hasil metadata di atas. INSERT boundary ini tidak bergantung pada pricing/role dan dapat diuji secara spesifik di staging **setelah** definisi trigger/RPC dan grants cocok. Jangan menjalankan runner yang ikut menerapkan pricing pending. Setelah remaining reports/Storage/notification hardening selesai dan smoke test Supabase nyata lulus, mintakan persetujuan production terpisah. Migration pricing/role lama tidak diubah oleh lanjutan ini.
