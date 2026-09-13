import * as ort from 'onnxruntime-web';
import { loadImage, resizeSquare, canvasToClipTensor } from './preprocess';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';

const MODEL_URL = '/models/clip-image-encoder.onnx';
const INPUT_SIZE = 224; // standard CLIP ViT-B/32 input size
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

/**
 * Returns a 512-dim, L2-normalized embedding vector (plain array) for an image.
 * This vector is what gets stored in Supabase's `embedding vector(512)` column
 * and compared with pgvector's cosine distance operator (<=>).
 */
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
  return dot; // both vectors are already L2-normalized, so dot product == cosine similarity
}

/**
 * Stand-in for embedImage() before clip-image-encoder.onnx is wired up.
 * Produces a stable-ish pseudo-embedding from the file so the duplicate-
 * detection UI can be built and tested end-to-end ahead of the real model.
 */
export async function embedImageMock(file) {
  await new Promise((r) => setTimeout(r, 400));
  const seed = Array.from(file.name).reduce((s, c) => s + c.charCodeAt(0), file.size);
  const vec = Array.from({ length: EMBEDDING_DIM }, (_, i) =>
    Math.sin(seed * (i + 1)) // deterministic pseudo-random
  );
  return l2Normalize(vec);
}
