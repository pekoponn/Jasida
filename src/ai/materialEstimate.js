import { getCostHistory } from '../lib/reports.js';

const MIN_SAMPLES = 3;

const MATERIAL_TABLE = {
  pothole: [
    { name: 'Aspal hotmix', unit: 'kg', basePricePerUnit: 1300, baseQuantity: 60 },
    { name: 'Agregat batu pecah', unit: 'kg', basePricePerUnit: 1200, baseQuantity: 40 },
    { name: 'Tack coat (aspal cair)', unit: 'liter', basePricePerUnit: 6000, baseQuantity: 5 },
  ],
  crack: [
    { name: 'Sealant aspal', unit: 'kg', basePricePerUnit: 35000, baseQuantity: 4 },
    { name: 'Pasir halus', unit: 'kg', basePricePerUnit: 300, baseQuantity: 10 },
    { name: 'Semen', unit: 'kg', basePricePerUnit: 1700, baseQuantity: 8 },
  ],
  other_corruption: [
    { name: 'Material tambal sulam umum', unit: 'kg', basePricePerUnit: 1300, baseQuantity: 30 },
    { name: 'Pasir', unit: 'kg', basePricePerUnit: 300, baseQuantity: 10 },
    { name: 'Semen', unit: 'kg', basePricePerUnit: 1700, baseQuantity: 8 },
  ],
};

function fitLinearRegression(points) {
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  const b = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const a = (sumY - b * sumX) / n;
  return { a, b };
}

function buildItems(entries, severityMultiplier, scaleFactor = 1) {
  return entries.map((e) => {
    const quantity = Math.max(1, Math.round(e.baseQuantity * severityMultiplier * scaleFactor));
    const unitPrice = e.basePricePerUnit;
    return { name: e.name, unit: e.unit, quantity, unitPrice, lineTotal: quantity * unitPrice };
  });
}

function sumItems(items) {
  return items.reduce((s, i) => s + i.lineTotal, 0);
}

export async function estimateMaterialsAndCost({ damageType, hazardScore, areaPct }) {
  const entries = MATERIAL_TABLE[damageType] ?? MATERIAL_TABLE.other_corruption;
  const severityMultiplier = 1 + Math.min(hazardScore ?? 0, 100) / 100;

  const heuristicItems = buildItems(entries, severityMultiplier);
  const heuristicTotal = sumItems(heuristicItems);

  let history = [];
  try {
    history = await getCostHistory(damageType);
  } catch (err) {
    console.warn('[material-estimate] gagal ambil data historis:', err.message);
  }

  const usable = history
    .filter((h) => typeof h.bbox_area_pct === 'number' && typeof h.actual_cost === 'number')
    .map((h) => ({ x: h.bbox_area_pct, y: h.actual_cost }));

  if (usable.length >= MIN_SAMPLES) {
    const { a, b } = fitLinearRegression(usable);
    const learnedTotal = Math.max(a + b * (areaPct ?? 0), 0);
    const scaleFactor = heuristicTotal > 0 ? learnedTotal / heuristicTotal : 1;
    const items = buildItems(entries, severityMultiplier, scaleFactor);
    return {
      items,
      totalCost: sumItems(items),
      isLearned: true,
      sampleSize: usable.length,
      confidenceNote: `Total biaya disesuaikan berdasarkan ${usable.length} data pengerjaan nyata sebelumnya untuk jenis kerusakan ini. Rincian per-material tetap perkiraan awal — cek dan sesuaikan.`,
    };
  }

  return {
    items: heuristicItems,
    totalCost: heuristicTotal,
    isLearned: false,
    sampleSize: usable.length,
    confidenceNote: `Estimasi awal (heuristik) — akan makin akurat setelah ada ${MIN_SAMPLES - usable.length} lagi data pengerjaan nyata.`,
  };
}

export function formatMaterialItems(items) {
  const lines = items.map(
    (i) =>
      `${i.name}: ${i.quantity} ${i.unit} x Rp${i.unitPrice.toLocaleString('id-ID')} = Rp${i.lineTotal.toLocaleString('id-ID')}`
  );
  const total = items.reduce((s, i) => s + i.lineTotal, 0);
  lines.push(`Total: Rp${total.toLocaleString('id-ID')}`);
  return lines.join('\n');
}
