import { supabase } from './supabaseClient.js';
import { normalized, validateReference } from './materialPricing.js';

export const priceReferenceFields = [
  'material_name',
  'specification',
  'unit',
  'reference_price',
  'reference_code',
  'source_name',
  'source_url',
  'effective_year',
  'price_type',
  'tax_inclusion',
];

export async function fetchPriceReferences() {
  const { data, error } = await supabase
    .from('material_price_references')
    .select('*')
    .order('material_name');
  if (error)
    throw new Error(
      'Katalog harga belum dapat dimuat. Pastikan migration material pricing sudah diterapkan. ' +
        error.message
    );
  return data ?? [];
}

export function referenceIdentity(row) {
  return `${String(row.reference_code ?? '').trim()}\u0000${row.effective_year}`;
}

export function referenceDifferences(a, b) {
  return priceReferenceFields.filter((field) => a[field] !== b[field]);
}

function cleanReference(row, index) {
  const clean = Object.fromEntries(priceReferenceFields.map((field) => [field, row?.[field]]));
  for (const field of [
    'material_name',
    'specification',
    'unit',
    'reference_code',
    'source_name',
    'source_url',
  ])
    if (typeof clean[field] === 'string') clean[field] = clean[field].trim();
  if (typeof clean.unit === 'string') clean.unit = clean.unit.toLowerCase();
  clean.verification_status = 'draft';
  clean.verified_at = null;
  const errors = validateReference(clean);
  if (errors.length) throw new Error(`Baris ${index + 1}: ${errors.join('; ')}`);
  return clean;
}

export function preparePriceImport(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 200)
    throw new Error('Import harus berupa array JSON berisi 1–200 item.');
  const seen = new Map();
  return rows.map((row, index) => {
    if (
      row?.verification_status != null &&
      !['draft', 'verified'].includes(row.verification_status)
    )
      throw new Error(`Baris ${index + 1}: Status verifikasi tidak valid`);
    const draft = cleanReference(row, index);
    const key = referenceIdentity(draft);
    if (seen.has(key)) {
      const first = seen.get(key);
      const differences = referenceDifferences(first.row, draft);
      if (!differences.length)
        throw new Error(`Baris ${index + 1} duplikat identik dengan baris ${first.index + 1}.`);
      throw new Error(
        `Konflik baris ${first.index + 1} dan ${index + 1}: kode ${draft.reference_code}, tahun ${draft.effective_year}; kolom berbeda: ${differences.join(', ')}.`
      );
    }
    seen.set(key, { row: draft, index });
    return draft;
  });
}

export function checkReferenceConflicts(rows, references, targetId = null) {
  const unchanged = [];
  for (const row of rows) {
    const previous = references.find(
      (reference) =>
        reference.id !== targetId && referenceIdentity(reference) === referenceIdentity(row)
    );
    if (!previous) continue;
    const differences = referenceDifferences(previous, row);
    if (differences.length)
      throw new Error(
        `Konflik referensi: kode ${row.reference_code}, tahun ${row.effective_year}; kolom berbeda: ${differences.join(', ')}. Data lama tidak diubah.`
      );
    if (targetId) throw new Error('Kode dan tahun sudah dipakai referensi lain.');
    unchanged.push(row);
  }
  return unchanged;
}

function samePossibleMaterial(a, b) {
  return (
    referenceIdentity(a) !== referenceIdentity(b) &&
    a.reference_code !== b.reference_code &&
    normalized(a.material_name) === normalized(b.material_name) &&
    normalized(a.specification) === normalized(b.specification) &&
    normalized(a.unit) === normalized(b.unit) &&
    a.effective_year === b.effective_year &&
    normalized(a.source_name) === normalized(b.source_name) &&
    a.source_url === b.source_url
  );
}

export function findPossibleDuplicates(rows, references, targetId = null) {
  const pairs = [];
  for (let index = 0; index < rows.length; index++) {
    const incoming = rows[index];
    for (const existing of references) {
      if (existing.id === targetId || !samePossibleMaterial(incoming, existing)) continue;
      pairs.push({ incoming, existing });
    }
    for (let prior = 0; prior < index; prior++) {
      if (samePossibleMaterial(incoming, rows[prior]))
        pairs.push({ incoming, existing: rows[prior] });
    }
  }
  return pairs;
}

async function writeReferences(
  rows,
  mode,
  { targetId = null, confirmed = false, reviewReason = '' } = {}
) {
  const { data, error } = await supabase.rpc('jasida_save_price_references', {
    p_rows: rows.map((row) =>
      Object.fromEntries(priceReferenceFields.map((field) => [field, row[field]]))
    ),
    p_mode: mode,
    p_target: targetId,
    p_confirmed: confirmed,
    p_review_reason: reviewReason,
  });
  if (error) {
    if (error.code === '23505')
      throw new Error('Konflik referensi: kode item dan tahun berlaku sudah terdaftar.');
    throw new Error(error.message);
  }
  return data;
}

export async function savePriceReferences(row, options = {}) {
  const drafts = preparePriceImport([row]);
  checkReferenceConflicts(drafts, options.references ?? []);
  return writeReferences(drafts, 'create', options);
}

export async function importPriceReferences(rows, options = {}) {
  const drafts = preparePriceImport(rows);
  checkReferenceConflicts(drafts, options.references ?? []);
  return writeReferences(drafts, 'import', options);
}

export async function editDraftPriceReference(row, targetId, options = {}) {
  if (!targetId) throw new Error('Pilih referensi Draft yang akan diubah.');
  const drafts = preparePriceImport([row]);
  checkReferenceConflicts(drafts, options.references ?? [], targetId);
  return writeReferences(drafts, 'edit_draft', { ...options, targetId });
}

export async function verifyPriceReference(row, targetId, confirmed) {
  if (!targetId || !confirmed) throw new Error('Konfirmasi pemeriksaan sumber sebelum verifikasi.');
  const drafts = preparePriceImport([row]);
  return writeReferences(drafts, 'verify', { targetId, confirmed: true });
}
