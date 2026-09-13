import * as ort from 'onnxruntime-web';
import { loadImage, letterbox, canvasToCHWTensor } from './preprocess';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';

// PENTING: urutan ini harus sama persis dengan urutan class di data.yaml
// waktu training combined_train2. Kalau urutannya beda, label yang
// muncul akan salah walau kotaknya tepat. Cek ulang data.yaml kalau ragu.
export const DAMAGE_CLASSES = [
  'pothole',
  'alligator_crack',
  'longitudinal_crack',
  'transverse_crack',
  'other_corruption',
  'sampah'
];

const MODEL_URL = '/models/yolo-damage.onnx';
const INPUT_SIZE = 640;
const CONF_THRESHOLD = 0.15;
const IOU_THRESHOLD = 0.45;

let sessionPromise = null;

function getSession() {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm']
    }).catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

/**
 * Runs damage detection on a File/Blob image.
 *
 * Returns { detections, imageWidth, imageHeight }
 *   detections: [{ damage_type, confidence, bbox: [x, y, w, h] }] (bbox px, gambar asli)
 *   imageWidth/imageHeight: dimensi asli foto (dipakai hazardScore.js buat bboxAreaRatio)
 */
export async function detectDamage(file) {
  const session = await getSession();
  const img = await loadImage(file);
  const { canvas, scale, padX, padY } = letterbox(img, INPUT_SIZE);
  const inputTensor = canvasToCHWTensor(canvas);

  const inputName = session.inputNames[0];
  const outputs = await session.run({ [inputName]: inputTensor });
  const outputName = session.outputNames[0];
  const raw = outputs[outputName];

  const detections = parseYoloOutput(raw, { scale, padX, padY });
  return { detections, imageWidth: img.naturalWidth ?? img.width, imageHeight: img.naturalHeight ?? img.height };
}

function parseYoloOutput(tensor, { scale, padX, padY }) {
  const [, numAttrs, numBoxes] = tensor.dims;
  const numClasses = numAttrs - 4;
  const data = tensor.data;

  const candidates = [];
  for (let i = 0; i < numBoxes; i++) {
    let bestClass = -1;
    let bestScore = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = data[(4 + c) * numBoxes + i];
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }
    if (bestScore < CONF_THRESHOLD) continue;

    const cx = data[0 * numBoxes + i];
    const cy = data[1 * numBoxes + i];
    const w = data[2 * numBoxes + i];
    const h = data[3 * numBoxes + i];

    const x = (cx - w / 2 - padX) / scale;
    const y = (cy - h / 2 - padY) / scale;
    const boxW = w / scale;
    const boxH = h / scale;

    candidates.push({
      damage_type: DAMAGE_CLASSES[bestClass] ?? `class_${bestClass}`,
      confidence: bestScore,
      bbox: [x, y, boxW, boxH]
    });
  }

  return nonMaxSuppression(candidates, IOU_THRESHOLD);
}

function nonMaxSuppression(boxes, iouThreshold) {
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const kept = [];
  while (sorted.length) {
    const current = sorted.shift();
    kept.push(current);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (iou(current.bbox, sorted[i].bbox) > iouThreshold) {
        sorted.splice(i, 1);
      }
    }
  }
  return kept;
}

function iou(a, b) {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const x2 = Math.min(ax + aw, bx + bw);
  const y2 = Math.min(ay + ah, by + bh);
  const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const unionArea = aw * ah + bw * bh - interArea;
  return unionArea <= 0 ? 0 : interArea / unionArea;
}

export async function detectDamageMock(file) {
  await new Promise((r) => setTimeout(r, 600));
  return {
    detections: [
      { damage_type: 'pothole', confidence: 0.91, bbox: [120, 340, 180, 140] },
      { damage_type: 'longitudinal_crack', confidence: 0.58, bbox: [400, 200, 320, 40] }
    ],
    imageWidth: 1280,
    imageHeight: 960
  };
}