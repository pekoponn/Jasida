import { detectDamage as realDetectDamage } from '../../src/ai/yolo.js';
import { loadImage } from '../../src/ai/preprocess.js';

// Deterministic positive detections let workflow tests exercise submission,
// storage failures and GPS validation independently of classifier accuracy.
export async function detectDamage(file) {
  const { real } = await (await fetch('/__test_detection')).json();
  if (real) return realDetectDamage(file);
  const img = await loadImage(file);
  return {
    imageWidth: img.naturalWidth,
    imageHeight: img.naturalHeight,
    detections: [{ damage_type: 'pothole', confidence: 0.9, bbox: [10, 10, 120, 100] }]
  };
}
