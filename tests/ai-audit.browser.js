// Local synthetic fixtures + real bundled ONNX. No database reads/writes.
(async () => {
  const { detectDamage, parseYoloOutput } = await import('/src/ai/yolo.js');
  const { embedImage } = await import('/src/ai/clip.js');
  const { prepareUploadPhoto } = await import('/src/lib/imageUpload.js');
  const { computeHazardScore } = await import('/src/ai/hazardScore.js');
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const samples = [];
  for (const [width, height] of [[800, 600], [300, 600]]) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#777'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#111'; ctx.fillRect(width / 3, height / 3, width / 4, height / 4);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'synthetic.png', { type: 'image/png' });
    const photo = await prepareUploadPhoto(file);
    const result = await detectDamage(photo);
    const score = computeHazardScore(result);
    assert(Number.isFinite(score.total) && score.total >= 0 && score.total <= 100, 'Invalid hazard score');
    assert(result.imageWidth === width && result.imageHeight === height, 'Image dimensions lost');
    assert(result.detections.every(d => Number.isFinite(d.confidence) && d.confidence >= 0 && d.confidence <= 1), 'Invalid confidence');
    samples.push({ width, height, detections: result.detections.length, score: score.total, bytes: photo.size });
  }
  const boxes = [
    [50, 50, 120, 120, 0.9, 0, 0, 0],
    [50, 50, 100, 100, 0.8, 0, 0, 0],
    [50, 50, 100, 100, 0, 0.85, 0, 0],
    [50, 50, NaN, 100, 0.99, 0, 0, 0]
  ];
  const data = new Float32Array(8 * boxes.length);
  for (let a = 0; a < 8; a++) for (let i = 0; i < boxes.length; i++) data[a * boxes.length + i] = boxes[i][a];
  const detections = parseYoloOutput({ dims: [1, 8, boxes.length], data }, { scale: 1, padX: 0, padY: 0, imageWidth: 100, imageHeight: 100 });
  assert(detections.length === 2, 'NMS must remove only overlapping boxes of the same class');
  assert(detections[0].bbox.join() === '0,0,100,100', 'Box extends beyond photo');
  let rejected = false;
  try { parseYoloOutput({ dims: [1, 10, 1], data: new Float32Array(10) }, {}); } catch { rejected = true; }
  assert(rejected, 'Incompatible model classes accepted');
  for (const [score, expected] of [[34,'aman'],[35,'sedang'],[69,'sedang'],[70,'darurat']]) {
    const result = computeHazardScore({ detections:[{damage_type:'pothole',confidence:score/70,bbox:[0,0,0,0]}],imageWidth:640,imageHeight:640 });
    assert(result.severity === expected, 'Wrong severity at ' + score);
  }
  let clipUnavailable = false;
  try { await embedImage(new File([], 'unused.webp')); } catch (err) { clipUnavailable = err.message.includes('belum tersedia'); }
  assert(clipUnavailable, 'Missing CLIP must be explicit');
  return { passed: true, samples, clipUnavailable, parserChecks: ['class-aware NMS', 'clipping', 'NaN rejection', 'model contract'] };
})()
