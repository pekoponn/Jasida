# Model AI

Folder ini menyimpan model ONNX yang dipakai langsung oleh browser.

`yolo-damage.onnx` adalah model yang sedang digunakan untuk memeriksa foto laporan.
Input model berbentuk float32 `[1, 3, 960, 960]` dan output-nya `[1, 8, 18900]`.
Urutan kelasnya adalah `pothole`, `alligator_crack`, `longitudinal_crack`, lalu
`transverse_crack`.

Jika model YOLO diganti, samakan urutan kelasnya dengan `DAMAGE_CLASSES` di
`src/ai/yolo.js`. Pengiriman laporan akan dihentikan jika model gagal dimuat atau
hasilnya tidak sesuai dengan bentuk yang diharapkan.

`clip-image-encoder.onnx` belum tersedia. Karena itu, pemeriksaan laporan ganda
masih menggunakan lokasi dan jenis kerusakan. Jika encoder CLIP ditambahkan,
pastikan output-nya berisi 512 nilai dan preprocessing-nya sesuai dengan model
yang dipakai saat training.
