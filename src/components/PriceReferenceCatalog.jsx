import { useState } from 'react';
import { savePriceReferences } from '../lib/priceCatalog.js';
import verifiedPrices from '../data/official-material-prices.json';
import { rupiah } from './MaterialEditor.jsx';
const empty = {
  material_name: '',
  specification: '',
  unit: 'kg',
  reference_price: '',
  reference_code: '',
  source_name: '',
  source_url: '',
  effective_year: 2026,
  verified_at: '',
  price_type: 'SSH',
  tax_inclusion: 'unknown',
  verification_status: 'draft',
};
export default function PriceReferenceCatalog({ references, onReload }) {
  const [form, setForm] = useState(empty),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [importRows, setImportRows] = useState(null);
  async function save(rows) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await savePriceReferences(rows);
      await onReload();
      setMessage(`${rows.length} harga acuan disimpan.`);
      setImportRows(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="pricing-panel">
      <summary>
        <strong>Katalog harga acuan resmi — input / import admin</strong>
      </summary>
      <p className="pricing-note">
        Verifikasi berarti admin telah memeriksa dokumen sumber, kode item, spesifikasi, satuan,
        tahun dan pajak. Domain resmi saja tidak membuktikan nominalnya benar. HSPK disimpan sebagai
        harga pekerjaan dan tidak dimasukkan ke chart harga material.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save([
            {
              ...form,
              reference_price: Number(form.reference_price),
              effective_year: Number(form.effective_year),
              verified_at:
                form.verification_status === 'verified' ? new Date().toISOString() : null,
            },
          ]);
        }}
      >
        <div className="pricing-form-grid">
          {[
            ['material_name', 'Nama material / pekerjaan'],
            ['specification', 'Spesifikasi'],
            ['unit', 'Satuan'],
            ['reference_price', 'Harga acuan (Rp)'],
            ['reference_code', 'Kode item'],
            ['source_name', 'Nama dokumen & halaman'],
            ['source_url', 'URL sumber resmi Sidoarjo'],
            ['effective_year', 'Tahun berlaku'],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required
                type={
                  ['reference_price', 'effective_year'].includes(key)
                    ? 'number'
                    : key === 'source_url'
                      ? 'url'
                      : 'text'
                }
                min={key === 'reference_price' ? '0.01' : undefined}
                step={key === 'reference_price' ? 'any' : undefined}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            Jenis harga
            <select
              value={form.price_type}
              onChange={(e) => setForm({ ...form, price_type: e.target.value })}
            >
              <option>SSH</option>
              <option>HSPK</option>
            </select>
          </label>
          <label>
            PPN
            <select
              value={form.tax_inclusion}
              onChange={(e) => setForm({ ...form, tax_inclusion: e.target.value })}
            >
              <option value="unknown">Belum diketahui</option>
              <option value="excluded">Sebelum PPN</option>
              <option value="included">Termasuk PPN</option>
            </select>
          </label>
          <label>
            Status
            <select
              value={form.verification_status}
              onChange={(e) => setForm({ ...form, verification_status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="verified">Sudah diverifikasi admin</option>
            </select>
          </label>
        </div>
        <p>
          <button disabled={busy}>Simpan harga acuan</button>
        </p>
      </form>
      <label>
        Import JSON (maks. 200 item, 1 MB)
        <input
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const file = e.target.files[0];
            setImportRows(null);
            setError('');
            if (!file) return;
            try {
              if (file.size > 1000000) throw new Error('File maksimal 1 MB.');
              const rows = JSON.parse(await file.text());
              if (!Array.isArray(rows) || !rows.length || rows.length > 200)
                throw new Error('Isi array 1–200 item.');
              setImportRows(rows);
            } catch (err) {
              setError(err.message);
            }
          }}
        />
      </label>
      <p>
        <button type="button" disabled={busy} onClick={() => setImportRows(verifiedPrices)}>
          Pratinjau 2 referensi terverifikasi Perbup 27/2025
        </button>
      </p>
      {importRows && (
        <>
          <pre style={{ maxHeight: 200, overflow: 'auto', fontSize: 12 }}>
            {JSON.stringify(importRows, null, 2)}
          </pre>
          <button disabled={busy} onClick={() => save(importRows)}>
            Simpan {importRows.length} referensi yang ditinjau
          </button>
          <p className="pricing-note">
            Kode item dan tahun yang sama memperbarui katalog; snapshot sumber pada estimasi
            historis tetap tersimpan.
          </p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="pricing-scroll">
        <table className="pricing-table">
          <thead>
            <tr>
              <th>Material & spesifikasi</th>
              <th>Harga / satuan</th>
              <th>Tahun / pajak</th>
              <th>Sumber / status</th>
            </tr>
          </thead>
          <tbody>
            {references.map((r) => (
              <tr key={r.id ?? r.reference_code}>
                <td>
                  {r.material_name}
                  <br />
                  {r.specification}
                </td>
                <td>
                  {rupiah(r.reference_price)} / {r.unit}
                </td>
                <td>
                  {r.effective_year} · {r.tax_inclusion}
                </td>
                <td>
                  <a href={r.source_url} target="_blank" rel="noreferrer">
                    {r.reference_code}
                  </a>
                  <br />
                  {r.verification_status}
                  <br />
                  {r.verified_at}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!references.length && (
        <p>Harga acuan belum tersedia. Isi atau import data yang sudah diperiksa.</p>
      )}
    </details>
  );
}
