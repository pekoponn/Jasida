Taruh file model kamu di sini setelah training + export:

- yolo-damage.onnx
- clip-image-encoder.onnx

Lihat README.md di root project, bagian "4. Menyiapkan model AI" untuk
langkah export dari Ultralytics/CLIP ke ONNX.

Sebelum kedua file ini ada, aplikasi otomatis memakai mock model
(src/ai/yolo.js -> detectDamageMock, src/ai/clip.js -> embedImageMock)
supaya alur UI tetap bisa dikembangkan dan didemokan.
