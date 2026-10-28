# Form katalog harga: urutan rilis

Migration `supabase/migrations/20261028_catalog_conflict_workflow.sql` belum dijalankan di production. Form baru memerlukan RPC dalam migration tersebut. Jangan menerbitkan frontend baru sebelum RPC aktif dan diuji di staging.

Migration ini menambah indeks unik untuk `btrim(reference_code), effective_year`, tabel alasan tinjauan, dan RPC admin yang memproses seluruh file dalam satu transaksi. RPC menormalisasi kode, memeriksa metadata dan konflik, mengunci tabel selama pemeriksaan, lalu hanya menambah Draft, mengedit Draft yang dipilih, atau memverifikasi Draft dengan konfirmasi. Jalur tulis langsung `authenticated` dicabut; SELECT admin dan RLS lama tetap ada. Dua referensi Verified yang sudah tersimpan tidak disentuh. Jika sudah ada dua kode yang hanya berbeda spasi, pembuatan indeks gagal dan seluruh migration batal tanpa menghapus baris.

Sebelum penerapan di tiap environment, cocokkan skema dan hak akses aktual. Periksa benturan kode yang sudah ada dengan query baca berikut:

```sql
SELECT btrim(reference_code) AS code, effective_year, count(*) AS rows
FROM public.material_price_references
GROUP BY btrim(reference_code), effective_year
HAVING count(*) > 1;
```

Uji migration di staging dengan admin dan pengguna biasa: pembuatan Draft, identitas sama yang identik, konflik harga/metadata, impor campuran yang ditolak seluruhnya, edit Draft, verifikasi, kemungkinan duplikat dengan alasan tercatat, dan larangan perubahan Verified. Terapkan migration yang sama melalui jalur migration tepercaya di production setelah staging lulus; baru kemudian rilis frontend. Jangan menandai migration di ledger tanpa menerapkannya, dan jangan menjalankan file draft SQL lain.

Tes PGlite memverifikasi fungsi, grants, RLS, hasil transaksi, dan indeks unik pada skema sintetis. Dua panggilan paralel pada satu PGlite tidak menggantikan tes konkurensi dua koneksi PostgreSQL; indeks unik serta lock tabel menjadi perlindungan database yang harus diuji lagi di staging nyata. Tidak ada tes yang menulis ke production.
