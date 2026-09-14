import * as ort from 'onnxruntime-web';
import { loadImage, resizeSquare, canvasToCHWTensor } from './preprocess';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';

export const SEVERITY_CLASSES = ['aman', 'darurat', 'sedang']; // urutan PERSIS dari model.names Colab
const MODEL_URL = '/models/severity-classifier.onnx';
const INPUT_SIZE = 224;

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

export async function classifyRoadSeverity(file) {
  const session = await getSession();
  const img = await loadImage(file);
  const canvas = resizeSquare(img, INPUT_SIZE);
  const inputTensor = canvasToCHWTensor(canvas);

  const inputName = session.inputNames[0];
  const outputs = await session.run({ [inputName]: inputTensor });
  const outputName = session.outputNames[0];
  const raw = outputs[outputName].data; 

  const scores = {};
  SEVERITY_CLASSES.forEach((cls, i) => {
    scores[cls] = raw[i];
  });

  let bestIdx = 0;
  for (let i = 1; i < raw.length; i++) {
    if (raw[i] > raw[bestIdx]) bestIdx = i;
  }

  return {
    severity: SEVERITY_CLASSES[bestIdx],
    confidence: raw[bestIdx],
    scores
  };
}

export async function classifyRoadSeverityMock(file) {
  await new Promise((r) => setTimeout(r, 600));
  return {
    severity: 'sedang',
    confidence: 0.82,
    scores: { aman: 0.1, sedang: 0.82, darurat: 0.08 }
  };
}