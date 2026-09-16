import { ort } from './runtime.js';
import { loadImage, resizeSquare, canvasToClipTensor } from './preprocess';


const MODEL_URL = '/models/clip-image-encoder.onnx';
const INPUT_SIZE = 224;
export const EMBEDDING_DIM = 512;

let sessionPromise = null;

function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const response = await fetch(MODEL_URL, { method: 'HEAD' });
      if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
        throw new Error('Model CLIP belum tersedia.');
      }
      return ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] });
    })().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

export async function embedImage(file) {
  const session = await getSession();
  const img = await loadImage(file);
  const canvas = resizeSquare(img, INPUT_SIZE);
  const inputTensor = canvasToClipTensor(canvas);

  const inputName = session.inputNames[0];
  const outputs = await session.run({ [inputName]: inputTensor });
  const outputName = session.outputNames[0];
  const raw = Array.from(outputs[outputName].data);
  if (raw.length !== EMBEDDING_DIM || raw.some((value) => !Number.isFinite(value))) {
    throw new Error('Output model CLIP tidak sesuai: diperlukan 512 angka valid.');
  }

  return l2Normalize(raw);
}

function l2Normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vec : vec.map((v) => v / norm);
}

export function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export async function embedImageMock(file) {
  await new Promise((r) => setTimeout(r, 400));
  const seed = Array.from(file.name).reduce((s, c) => s + c.charCodeAt(0), file.size);
  const vec = Array.from({ length: EMBEDDING_DIM }, (_, i) =>
    Math.sin(seed * (i + 1)) // deterministic pseudo-random
  );
  return l2Normalize(vec);
}
