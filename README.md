# RoadWatch AI

Prototype lomba: pelaporan kerusakan infrastruktur jalan dengan dua fitur AI
(deteksi kerusakan + hazard scoring, dan pencegahan laporan ganda), AI jalan
sepenuhnya di browser via ONNX Runtime Web — tidak perlu server GPU.

```
FRONTEND        React + Vite, hosting Vercel (free)
BACKEND/DB      Supabase (free) — PostgreSQL + PostGIS + pgvector + Storage + Auth
AI              ONNX Runtime Web, jalan di browser pengguna
```

## Struktur project

```
src/
├── ai/
│   ├── preprocess.js     # letterbox, tensor conversion (YOLO & CLIP)
│   ├── yolo.js            # deteksi jenis kerusakan (+ mock fallback)
│   ├── clip.js             # image embedding untuk kemiripan foto (+ mock fallback)
│   ├── hazardScore.js     # rule engine: visual + lokasi + komunitas -> skor 0-100
│   └── duplicateScore.js  # gabungkan hasil RPC jadi probabilitas duplikat
├── lib/
│   ├── supabaseClient.js
│   ├── reports.js         # semua query/RPC Supabase
│   └── geolocation.js
├── features/
│   ├── report-upload/PhotoPicker.jsx
│   └── duplicate-check/DuplicateModal.jsx
├── components/SeverityBadge.jsx
├── pages/
│   ├── ReportPage.jsx     # alur utama: foto -> AI -> cek duplikat -> kirim
│   └── MapPage.jsx        # peta semua laporan aktif (Leaflet + OSM)
└── App.jsx

supabase/schema.sql        # jalankan sekali di SQL Editor Supabase
public/models/              # taruh file .onnx kamu di sini (lihat bawah)
```

## 0. Prasyarat

- Node.js 18+
- Akun [Supabase](https://supabase.com) (free tier)
- Akun [Vercel](https://vercel.com) (untuk deploy, opsional saat development)

## 1. Install dependencies

```bash
npm install
```

## 2. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor** → **New query**, tempel seluruh isi `supabase/schema.sql`, lalu **Run**.
   Ini akan mengaktifkan extension PostGIS + pgvector, membuat tabel `reports` &
   `report_images`, dua RPC (`find_similar_reports`, `increment_support`), RLS
   policy, dan storage bucket `report-images`.
3. Buka **Project Settings → API**, salin `Project URL` dan `anon public` key.
4. Salin `.env.example` menjadi `.env`, isi dua variabel tersebut:

```bash
cp .env.example .env
```

## 3. Jalankan development server

```bash
npm run dev
```

Buka `http://localhost:5173`. Alur "Lapor" akan langsung bisa dicoba —
karena model `.onnx` belum ada di `public/models`, app otomatis fallback ke
**mock model** (ada label kuning peringatan di UI) supaya kamu bisa membangun
dan mendemokan seluruh alur UI/UX sebelum model AI selesai dilatih.

## 4. Menyiapkan model AI (menggantikan mock)

### 4a. YOLO — deteksi jenis kerusakan

1. Siapkan dataset (mulai dari RDD2022 + foto tambahan Indonesia, lihat
   rekomendasi kategori: `pothole`, `longitudinal_crack`, `transverse_crack`,
   `alligator_crack`, `broken_sidewalk`).
2. Latih dengan Ultralytics:
   ```python
   from ultralytics import YOLO
   model = YOLO("yolo26n.pt")
   model.train(data="dataset.yaml", epochs=100, imgsz=640)
   ```
3. Export ke ONNX:
   ```python
   model.export(format="onnx", imgsz=640, simplify=True)
   ```
4. Salin hasilnya ke `public/models/yolo-damage.onnx`.
5. **Penting:** urutan kelas di `DAMAGE_CLASSES` (`src/ai/yolo.js`) harus
   persis sama dengan urutan kelas saat training (biasanya sesuai urutan di
   `dataset.yaml`).

### 4b. CLIP — image embedding untuk deteksi duplikat

1. Export CLIP image encoder (bagian vision tower saja, bukan text encoder)
   ke ONNX. Kalau pakai `open_clip` atau HuggingFace `transformers`, banyak
   contoh export tersedia di masing-masing repo — cari yang mengekspor
   khusus `visual` / image encoder ViT-B/32 agar ukurannya tidak terlalu besar.
2. Pastikan dimensi output = 512 (sesuai kolom `embedding vector(512)` di
   database). Kalau modelmu punya dimensi lain, ubah `EMBEDDING_DIM` di
   `src/ai/clip.js` **dan** kolom `embedding` di `supabase/schema.sql`.
3. Salin hasilnya ke `public/models/clip-image-encoder.onnx`.

Setelah kedua file ini ada, `detectDamage()` dan `embedImage()` di
`ReportPage.jsx` otomatis dipakai (mock berhenti dipanggil) — tidak ada
perubahan kode lain yang diperlukan.

## 5. Deploy

**Frontend (Vercel):**
```bash
npm run build
```
Push ke GitHub, import repo di Vercel, tambahkan environment variables
`VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di project settings Vercel,
deploy.

**Backend:** tidak perlu deploy apa pun — Supabase sudah live begitu project
dibuat. Model AI ikut ter-deploy otomatis sebagai static file bersama frontend
(taruh di `public/models`, akan ke-bundle ke `dist/models` saat build).

## 6. Urutan pengerjaan yang disarankan

1. **Tahap 1** — Upload foto + GPS, simpan ke Supabase, tampilkan di peta.
   (Sudah jalan out of the box begitu `.env` diisi, walau AI masih mock.)
2. **Tahap 2** — Latih & export YOLO, taruh di `public/models/yolo-damage.onnx`.
3. **Tahap 3** — Kalibrasi bobot `hazardScore.js` sesuai kondisi kota demo.
4. **Tahap 4** — Export CLIP, taruh di `public/models/clip-image-encoder.onnx`,
   uji alur deteksi duplikat dengan 2 foto lokasi yang sama.
5. **Tahap 5** — Uji alur "Dukung laporan ini" end-to-end, sesuaikan threshold
   di `duplicateScore.js` (`auto_merge` / `ask_user` / `new_report`) dari hasil
   pengujian nyata.

## Catatan teknis penting

- **Ukuran model**: usahakan YOLO nano (~6MB) dan CLIP versi kecil/terkuantisasi
  — model besar (150MB+) akan membuat load pertama sangat lambat di HP juri.
- **Preprocessing harus identik** antara training (Python) dan inference
  (`src/ai/preprocess.js`) — resize, normalisasi, dan urutan channel yang
  berbeda akan membuat akurasi anjlok tanpa error apa pun.
- **Threshold dan bobot** di `hazardScore.js` dan `duplicateScore.js` adalah
  titik awal, bukan angka final — sesuaikan dengan data validasi kamu sendiri
  sebelum demo.
