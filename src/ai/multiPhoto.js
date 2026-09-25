import { computeHazardScore } from './hazardScore.js';

export const MAX_REPORT_PHOTOS = 5;

// Score each view separately: the same pothole in two photos is not two potholes.
export function summarizePhotoAnalyses(analyses) {
  const results = analyses.map((analysis) => {
    const detections = analysis.detections.filter((d) => d.confidence >= 0.4);
    return { ...analysis, detections, hazard: computeHazardScore({ ...analysis, detections }) };
  });
  const positive = results
    .map((result, index) => ({ ...result, index }))
    .filter((result) => result.detections.length)
    .sort((a, b) => a.hazard.total - b.hazard.total);
  if (!positive.length) return { results, hazard: null, representativeIndex: 0, positiveCount: 0 };
  const middle = Math.floor(positive.length / 2);
  const total =
    positive.length % 2
      ? positive[middle].hazard.total
      : Math.round((positive[middle - 1].hazard.total + positive[middle].hazard.total) / 2);
  const representative = positive[middle];
  return {
    results,
    positiveCount: positive.length,
    representativeIndex: representative.index,
    hazard: {
      ...representative.hazard,
      total,
      severity: total >= 70 ? 'darurat' : total >= 35 ? 'sedang' : 'aman',
    },
  };
}
