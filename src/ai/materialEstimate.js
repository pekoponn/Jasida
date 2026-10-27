// AI suggests a repair family only; photo pixels are never converted to metres.
export const REPAIR_METHODS = {
  patch: { label: 'Tambal lubang lokal', basis: 'm3', materials: ['Aspal hotmix', 'Tack coat'] },
  structural: {
    label: 'Perbaikan lapisan / retak buaya',
    basis: 'm3',
    materials: ['Aspal hotmix', 'Agregat', 'Tack coat'],
  },
  longitudinal: { label: 'Penutupan retak memanjang', basis: 'm', materials: ['Sealant aspal'] },
  transverse: { label: 'Penutupan retak melintang', basis: 'm', materials: ['Sealant aspal'] },
  manual: { label: 'Metode hasil pemeriksaan lapangan', basis: 'm2', materials: [] },
};
export const DAMAGE_METHOD = {
  pothole: 'patch',
  alligator_crack: 'structural',
  longitudinal_crack: 'longitudinal',
  transverse_crack: 'transverse',
};
export const AHSP_URL =
  'https://binakonstruksi.pu.go.id/sdm_downloads/lampiran-v-se-djbk-no-47-se-dk-2026/';
export function newMaterial(name = '') {
  return {
    name,
    specification: '',
    unit: 'kg',
    category: 'material',
    quantity: '',
    unitPrice: '',
    lineTotal: 0,
    tax_inclusion: 'unknown',
    price_origin: 'manual',
  };
}
export function suggestEstimate(damageType) {
  const method = DAMAGE_METHOD[damageType] ?? 'manual';
  return {
    method,
    items: REPAIR_METHODS[method].materials.map(newMaterial),
    confidenceNote:
      'Saran awal berdasarkan kelas kerusakan AI. Metode, dimensi, jumlah, dan harga wajib diverifikasi di lapangan. Skor bahaya dan bounding box bukan ukuran fisik.',
  };
}
export async function estimateMaterialsAndCost({ damageType }) {
  return suggestEstimate(damageType);
}
export const validNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export function validItems(items) {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    Number.isFinite(totalItems(items)) &&
    items.every(
      (i) =>
        i.name?.trim() &&
        i.unit?.trim() &&
        ['material', 'labor', 'equipment', 'other'].includes(i.category) &&
        validNumber(i.quantity) &&
        i.quantity > 0 &&
        validNumber(i.unitPrice)
    )
  );
}
export function totalItems(items) {
  return items.reduce(
    (sum, i) =>
      sum + (validNumber(i.quantity) && validNumber(i.unitPrice) ? i.quantity * i.unitPrice : 0),
    0
  );
}
export function measureWork({ basis, length, width, depth, area }) {
  const positive = (n) => validNumber(n) && n > 0;
  if (basis === 'm') {
    if (!positive(length)) throw new Error('Panjang harus positif.');
    return length;
  }
  const a = positive(area) ? area : positive(length) && positive(width) ? length * width : null;
  if (!positive(a)) throw new Error('Isi luas atau panjang dan lebar yang positif.');
  if (basis === 'm2') return a;
  if (basis !== 'm3' || !positive(depth)) throw new Error('Ketebalan (m) harus positif.');
  if (!Number.isFinite(a * depth)) throw new Error('Volume terlalu besar.');
  return a * depth;
}
export function applyCoefficients(items, measurement) {
  const volume = measureWork(measurement);
  let url;
  try {
    url = new URL(measurement.source_url);
  } catch {
    throw new Error('Isi URL sumber koefisien AHSP.');
  }
  if (
    url.protocol !== 'https:' ||
    !(url.hostname === 'pu.go.id' || url.hostname.endsWith('.pu.go.id')) ||
    !measurement.reference_code?.trim()
  )
    throw new Error('Isi sumber resmi PU dan kode analisis/halaman koefisien.');
  return items.map((item) => {
    if (!validNumber(item.coefficient) || item.coefficient <= 0)
      throw new Error(`Isi koefisien positif untuk ${item.name}.`);
    const quantity = Number((volume * item.coefficient).toFixed(6));
    if (!Number.isFinite(quantity) || quantity <= 0)
      throw new Error('Jumlah hasil perhitungan tidak valid.');
    return {
      ...item,
      quantity,
      lineTotal: quantity * (item.unitPrice || 0),
      calculation: {
        ...measurement,
        volume,
        coefficient: item.coefficient,
        formula: 'volume pekerjaan × koefisien per satuan pekerjaan',
        verified_by: 'admin',
      },
    };
  });
}
export function formatMaterialItems(items) {
  return [
    ...items.map(
      (i) =>
        `${i.name} (${i.category}): ${i.quantity} ${i.unit} × Rp${Number(i.unitPrice).toLocaleString('id-ID')} = Rp${(i.quantity * i.unitPrice).toLocaleString('id-ID')}`
    ),
    `Total: Rp${totalItems(items).toLocaleString('id-ID')}`,
  ].join('\n');
}
