import * as ort from 'onnxruntime-web/wasm';

// Serve the runtime alongside the model: no CDN/version mismatch at inference time.
ort.env.wasm.wasmPaths = '/ort/';
ort.env.wasm.numThreads = 1;

export { ort };
