const CLASS_BASE_SCORE = {
  pothole: 70,
  alligator_crack: 55,
  other_corruption: 50,
  longitudinal_crack: 40,
  transverse_crack: 35
};

const CLASS_AREA_SENSITIVITY = {
  pothole: 1.4,
  alligator_crack: 1.0,
  other_corruption: 1.0,
  longitudinal_crack: 0.6,
  transverse_crack: 0.6
};

const MAX_AREA_BOOST = 40;
const MULTI_DETECTION_BONUS = 3; 
const MULTI_DETECTION_THRESHOLD = 40; 
const MAX_MULTI_BONUS = 15; 

const SEVERITY_SCORE_RANGE = {
  aman: [0, 34],
  sedang: [35, 69],
  darurat: [70, 100]
};

export const DAMAGE_TYPE_LABEL_ID = {
  pothole: 'Lubang Jalan',
  alligator_crack: 'Retak Buaya',
  longitudinal_crack: 'Retak Memanjang',
  transverse_crack: 'Retak Melintang',
  other_corruption: 'Kerusakan Lain'
};

/**
 * @param {{ damage_type: string, confidence: number, bbox: [number,number,number,number] }[]} detections
 * @param {number} imageWidth
 * @param {number} imageHeight
 */
export function computeHazardScore({ detections = [], imageWidth, imageHeight }) {
  if (!detections.length || !imageWidth || !imageHeight) {
    return { total: 0, severity: 'aman', dominant: null, breakdown: [] };
  }

  const scored = detections.map((d) => {
    const [, , boxW, boxH] = d.bbox;
    const areaRatio = Math.max(0, Math.min(1, (boxW * boxH) / (imageWidth * imageHeight)));

    const base = CLASS_BASE_SCORE[d.damage_type] ?? 30;
    const sensitivity = CLASS_AREA_SENSITIVITY[d.damage_type] ?? 1.0;
    const areaBoost = Math.min(areaRatio * 100 * sensitivity, MAX_AREA_BOOST);

    const rawScore = base * d.confidence + areaBoost;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    return { ...d, bboxAreaRatio: areaRatio, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const dominant = scored[0];

  const extraSevereCount = scored
    .slice(1)
    .filter((d) => d.score >= MULTI_DETECTION_THRESHOLD).length;
  const multiBonus = Math.min(extraSevereCount * MULTI_DETECTION_BONUS, MAX_MULTI_BONUS);

  const total = Math.max(0, Math.min(100, Math.round(dominant.score + multiBonus)));
  const severity = scoreToSeverity(total);

  return { total, severity, dominant, breakdown: scored };
}

function scoreToSeverity(score) {
  for (const [severity, [min, max]] of Object.entries(SEVERITY_SCORE_RANGE)) {
    if (score >= min && score <= max) return severity;
  }
  return 'aman';
}

const SEVERITY_LABEL_ID = {
  aman: 'Aman',
  sedang: 'Sedang',
  darurat: 'Darurat'
};

export function severityDisplayLabel(severity) {
  return SEVERITY_LABEL_ID[severity] ?? severity;
}

export function damageTypeDisplayLabel(damageType) {
  return DAMAGE_TYPE_LABEL_ID[damageType] ?? damageType;
}