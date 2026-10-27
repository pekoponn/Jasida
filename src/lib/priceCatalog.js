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
