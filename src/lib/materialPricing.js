import { validNumber } from '../ai/materialEstimate.js';
export const normalized = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
const units = {
  kg: ['mass', 1],
  ton: ['mass', 1000],
  g: ['mass', 0.001],
  liter: ['volume', 1],
  ml: ['volume', 0.001],
  m3: ['volume', 1000],
  m2: ['area', 1],
  m: ['length', 1],
  sak: ['sak', 1],
  buah: ['buah', 1],
  batang: ['batang', 1],
  lembar: ['lembar', 1],
  pak: ['pak', 1],
  botol: ['botol', 1],
};
export const supportedPriceUnits = Object.keys(units);
export function convertPrice(price, from, to) {
  const a = units[normalized(from)],
    b = units[normalized(to)];
  return validNumber(price) && a && b && a[0] === b[0] ? (price * b[1]) / a[1] : null;
}
export function officialUrl(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      (u.hostname === 'sidoarjokab.go.id' || u.hostname.endsWith('.sidoarjokab.go.id'))
    );
  } catch {
    return false;
  }
}
export function validateReference(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r))
    return ['Item harus berupa objek metadata harga'];
  const errors = [];
  for (const k of ['material_name', 'specification', 'unit', 'reference_code', 'source_name'])
    if (typeof r[k] !== 'string' || !r[k].trim()) errors.push(`${k} wajib diisi`);
  if (!supportedPriceUnits.includes(normalized(r.unit))) errors.push('Satuan tidak didukung');
  for (const [key, max] of [
    ['material_name', 200],
    ['specification', 500],
    ['reference_code', 100],
    ['source_name', 500],
    ['source_url', 2048],
  ])
    if (typeof r[key] === 'string' && r[key].length > max) errors.push(`${key} terlalu panjang`);
  if (!validNumber(r.reference_price) || r.reference_price <= 0 || r.reference_price >= 1e15)
    errors.push('Harga acuan harus positif');
  if (!officialUrl(r.source_url)) errors.push('URL harus HTTPS domain resmi Sidoarjo');
  if (!Number.isInteger(r.effective_year) || r.effective_year < 2000 || r.effective_year > 2100)
    errors.push('Tahun tidak valid');
  if (!['SSH', 'HSPK'].includes(r.price_type)) errors.push('Jenis harga harus SSH atau HSPK');
  if (!['included', 'excluded', 'unknown'].includes(r.tax_inclusion))
    errors.push('Status pajak tidak valid');
  if (!['verified', 'draft'].includes(r.verification_status))
    errors.push('Status verifikasi tidak valid');
  if (
    r.verification_status === 'verified' &&
    (!r.verified_at ||
      !Number.isFinite(Date.parse(r.verified_at)) ||
      Date.parse(r.verified_at) > Date.now())
  )
    errors.push('Tanggal verifikasi tidak valid');
  return errors;
}
export function compareMaterial(item, reference, year) {
  if (
    !reference ||
    validateReference(reference).length ||
    reference.verification_status !== 'verified' ||
    reference.price_type !== 'SSH' ||
    item.category !== 'material' ||
    !item.specification?.trim() ||
    normalized(item.name) !== normalized(reference.material_name) ||
    normalized(item.specification) !== normalized(reference.specification) ||
    reference.effective_year !== year ||
    item.tax_inclusion === 'unknown' ||
    item.tax_inclusion !== reference.tax_inclusion ||
    !validNumber(item.unitPrice)
  )
    return null;
  const price = convertPrice(reference.reference_price, reference.unit, item.unit);
  if (!(price > 0)) return null;
  const deviation = (Math.abs(item.unitPrice - price) / price) * 100;
  return {
    referencePrice: price,
    difference: item.unitPrice - price,
    deviation,
    score: Math.max(0, 100 - deviation),
    sameSource:
      item.price_origin === 'reference' && item.reference_code === reference.reference_code,
  };
}
export function isEvaluationPair(r) {
  return (
    r.status === 'resolved' &&
    validNumber(r.estimated_cost) &&
    validNumber(r.actual_cost) &&
    r.actual_cost_verified === true &&
    typeof r.actual_cost_evidence === 'string' &&
    r.actual_cost_evidence.trim().length > 0 &&
    r.estimate_recorded_at &&
    r.resolved_at &&
    Date.parse(r.estimate_recorded_at) < Date.parse(r.resolved_at)
  );
}
export function evaluateCosts(reports) {
  const seen = new Set();
  const pairs = reports.filter(
    (r) => r.id && isEvaluationPair(r) && !seen.has(r.id) && seen.add(r.id)
  );
  const estimated = pairs.reduce((s, r) => s + r.estimated_cost, 0);
  const actual = pairs.reduce((s, r) => s + r.actual_cost, 0);
  const absoluteError = pairs.reduce((s, r) => s + Math.abs(r.estimated_cost - r.actual_cost), 0);
  const wape = actual > 0 ? (absoluteError / actual) * 100 : null;
  return {
    pairs,
    n: pairs.length,
    estimated,
    actual,
    wape,
    score: wape == null ? null : Math.max(0, 100 - wape),
    mae: pairs.length ? absoluteError / pairs.length : null,
  };
}
export function materialComposition(reports) {
  const groups = {};
  for (const r of reports)
    for (const i of r.estimated_materials_json ?? []) {
      if (i.category !== 'material' || !validNumber(i.quantity) || !validNumber(i.unitPrice))
        continue;
      const name = /hotmix/i.test(i.name)
        ? 'Hotmix'
        : /agregat/i.test(i.name)
          ? 'Agregat'
          : /tack coat/i.test(i.name)
            ? 'Tack coat'
            : /sealant/i.test(i.name)
              ? 'Sealant'
              : 'Material lain';
      groups[name] = (groups[name] ?? 0) + i.quantity * i.unitPrice;
    }
  return Object.entries(groups)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));
}
