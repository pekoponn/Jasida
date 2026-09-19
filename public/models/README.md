Taruh file model kamu di sini setelah training + export:

- yolo-damage.onnx
- clip-image-encoder.onnx

Lihat README.md di root project, bagian "4. Menyiapkan model AI" untuk
langkah export dari Ultralytics/CLIP ke ONNX.

`yolo-damage.onnx` sudah tersedia dan digunakan untuk analisis laporan.
Kontrak model bawaan: input float32 `[1,3,960,960]`, output `[1,8,18900]`.
Empat kelas: `pothole`, `alligator_crack`, `longitudinal_crack`, `transverse_crack`.
Ukuran input dibaca dari metadata; urutan label wajib disesuaikan jika model diganti.
Jika analisis gagal, pengiriman ditahan; halaman laporan tidak memakai mock.
`clip-image-encoder.onnx` belum tersedia sehingga pemeriksaan visual duplikat
belum aktif; pemeriksaan lokasi + jenis tetap memberikan saran dengan konfirmasi
pengguna. Pastikan encoder menghasilkan 512 nilai dan preprocessing sesuai
model sebelum mengaktifkannya. Label laporan saat ini berasal dari YOLO dan
aturan `src/ai/hazardScore.js`.
