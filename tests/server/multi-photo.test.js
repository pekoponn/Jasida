import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePhotoAnalyses } from '../../src/ai/multiPhoto.js';

const view = (confidence = 0.9) => ({
  imageWidth: 1000,
  imageHeight: 1000,
  detections: [{ damage_type: 'pothole', confidence, bbox: [10, 10, 100, 100] }],
});

test('repeated views do not increase the score or detection count', () => {
  const one = summarizePhotoAnalyses([view()]);
  const many = summarizePhotoAnalyses([view(), view(), view()]);
  assert.equal(many.hazard.total, one.hazard.total);
  assert.equal(many.hazard.breakdown.length, 1);
  assert.equal(many.positiveCount, 3);
});

test('weak detections and empty views do not become accepted damage', () => {
  const result = summarizePhotoAnalyses([view(0.39), { ...view(), detections: [] }]);
  assert.equal(result.hazard, null);
  assert.equal(result.positiveCount, 0);
});

test('mixed views keep individual evidence and use median positive score', () => {
  const views = [view(0.4), view(0.7), view(0.99), { ...view(), detections: [] }];
  const result = summarizePhotoAnalyses(views);
  assert.equal(result.hazard.total, summarizePhotoAnalyses([views[1]]).hazard.total);
  assert.equal(result.representativeIndex, 1);
  assert.equal(result.results.length, 4);
  assert.equal(result.positiveCount, 3);
});
