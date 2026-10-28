import { supabase } from './supabaseClient.js';
import { validateReference } from './materialPricing.js';
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
export async function savePriceReferences(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 200)
    throw new Error('Import harus berupa array JSON berisi 1–200 item.');
  const fields = [
    'material_name',
    'specification',
    'unit',
    'reference_price',
    'reference_code',
    'source_name',
    'source_url',
    'effective_year',
    'verified_at',
    'price_type',
    'tax_inclusion',
    'verification_status',
  ];
  const clean = rows.map((row, index) => {
    const errors = validateReference(row);
    if (errors.length) throw new Error(`Baris ${index + 1}: ${errors.join('; ')}`);
    return Object.fromEntries(fields.map((key) => [key, row[key]]));
  });
  const { error } = await supabase
    .from('material_price_references')
    .upsert(clean, { onConflict: 'reference_code,effective_year' });
  if (error) throw error;
}

export function preparePriceImport(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 200)
    throw new Error('Import harus berupa array JSON berisi 1–200 item.');
  const seen = new Set();
  return rows.map((row, index) => {
    if (
      row?.verification_status != null &&
      !['draft', 'verified'].includes(row.verification_status)
    )
      throw new Error(`Baris ${index + 1}: Status verifikasi tidak valid`);
    // A JSON file is evidence to inspect, never an admin verification event.
    const draft = { ...row, verification_status: 'draft', verified_at: null };
    const errors = validateReference(draft);
    if (errors.length) throw new Error(`Baris ${index + 1}: ${errors.join('; ')}`);
    const key = `${draft.reference_code.trim()}\u0000${draft.effective_year}`;
    if (seen.has(key)) throw new Error(`Baris ${index + 1}: Kode dan tahun duplikat`);
    seen.add(key);
    return draft;
  });
}

export async function importPriceReferences(rows) {
  const drafts = preparePriceImport(rows);
  const fields = [
    'material_name',
    'specification',
    'unit',
    'reference_price',
    'reference_code',
    'source_name',
    'source_url',
    'effective_year',
    'verified_at',
    'price_type',
    'tax_inclusion',
    'verification_status',
  ];
  const clean = drafts.map((row) => Object.fromEntries(fields.map((field) => [field, row[field]])));
  const { error } = await supabase
    .from('material_price_references')
    .upsert(clean, { onConflict: 'reference_code,effective_year', ignoreDuplicates: true });
  if (error) throw error;
}
