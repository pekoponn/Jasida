import { Tensor } from 'onnxruntime-web';

/**
 * Load a File/Blob into an HTMLImageElement.
 */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Draw an image onto a square canvas of `size` x `size`, letterboxing
 * (padding) so aspect ratio is preserved — this MUST match whatever
 * preprocessing was used during training/export, or accuracy silently drops.
 *
 * Returns { canvas, scale, padX, padY } so callers can map bounding boxes
 * back to original image coordinates.
 */
export function letterbox(img, size = 640) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // fill with neutral gray padding (common YOLO convention)
  ctx.fillStyle = 'rgb(114,114,114)';
  ctx.fillRect(0, 0, size, size);

  const scale = Math.min(size / img.width, size / img.height);
  const newW = Math.round(img.width * scale);
  const newH = Math.round(img.height * scale);
  const padX = Math.floor((size - newW) / 2);
  const padY = Math.floor((size - newH) / 2);

  ctx.drawImage(img, 0, 0, img.width, img.height, padX, padY, newW, newH);

  return { canvas, scale, padX, padY };
}

/**
 * Convert a canvas to a normalized CHW Float32 tensor in [0, 1],
 * the standard input format for Ultralytics YOLO ONNX exports.
 */
export function canvasToCHWTensor(canvas) {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, width, height);

  const chw = new Float32Array(3 * width * height);
  const plane = width * height;

  for (let i = 0; i < plane; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    chw[i] = r;                 // R plane
    chw[plane + i] = g;         // G plane
    chw[plane * 2 + i] = b;     // B plane
  }

  return new Tensor('float32', chw, [1, 3, height, width]);
}

/**
 * Convert a canvas to a normalized CHW tensor using CLIP's mean/std
 * (ImageNet-ish normalization used by most CLIP ONNX exports).
 */
const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073];
const CLIP_STD = [0.26862954, 0.26130258, 0.27577711];

export function canvasToClipTensor(canvas) {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, width, height);

  const chw = new Float32Array(3 * width * height);
  const plane = width * height;

  for (let i = 0; i < plane; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    chw[i] = (r - CLIP_MEAN[0]) / CLIP_STD[0];
    chw[plane + i] = (g - CLIP_MEAN[1]) / CLIP_STD[1];
    chw[plane * 2 + i] = (b - CLIP_MEAN[2]) / CLIP_STD[2];
  }

  return new Tensor('float32', chw, [1, 3, height, width]);
}

export function resizeSquare(img, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  return canvas;
}
