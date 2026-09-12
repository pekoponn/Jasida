Taruh file model kamu di sini setelah training + export:

- yolo-damage.onnx
- clip-image-encoder.onnx

Lihat README.md di root project, bagian "4. Menyiapkan model AI" untuk
langkah export dari Ultralytics/CLIP ke ONNX.

`yolo-damage.onnx` sudah tersedia dan digunakan untuk analisis laporan.
Jika analisis gagal, pengiriman ditahan; halaman laporan tidak memakai mock.
`clip-image-encoder.onnx` belum tersedia sehingga pemeriksaan visual duplikat
belum aktif. Pastikan encoder menghasilkan 512 nilai dan preprocessing sesuai
model sebelum mengaktifkannya. `severity-classifier.onnx` masih disimpan untuk
modul `src/ai/severity.js`, tetapi label laporan saat ini berasal dari YOLO
dan aturan `src/ai/hazardScore.js`.
