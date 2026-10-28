import { useRef, useState } from 'react';
import {
  checkReferenceConflicts,
  editDraftPriceReference,
  findPossibleDuplicates,
  importPriceReferences,
  preparePriceImport,
  savePriceReferences,
  verifyPriceReference,
} from '../lib/priceCatalog.js';
import { supportedPriceUnits, validateReference } from '../lib/materialPricing.js';
import verifiedPrices from '../data/official-material-prices.json';
import { rupiah } from './MaterialEditor.jsx';

const example = {
  material_name: 'Semen Portland',
  specification: 'SNI',
  unit: 'kg',
  reference_price: '1960',
  reference_code: '',
  source_name: '',
  source_url: '',
  effective_year: 2026,
  price_type: 'SSH',
  tax_inclusion: 'unknown',
};

const sourceFields = [
  ['reference_code', 'Kode referensi'],
  ['source_name', 'Nama dokumen sumber dan halaman'],
  ['source_url', 'URL sumber resmi'],
  ['effective_year', 'Tahun berlaku'],
];

export default function PriceReferenceCatalog({ references, onReload }) {
  const [form, setForm] = useState(example);
  const [target, setTarget] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [attested, setAttested] = useState(false);
  const [reviewReason, setReviewReason] = useState('');
  const [importRows, setImportRows] = useState(null);
  const sourceDetails = useRef(null);
  const formRef = useRef(null);

  const current = {
    ...form,
    reference_price: Number(form.reference_price),
    effective_year: Number(form.effective_year),
  };
  const formWarnings = findPossibleDuplicates([current], references, target?.id);
  const importWarnings = importRows ? findPossibleDuplicates(importRows, references) : [];

  function updateForm(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setReviewReason('');
  }

  function resetForm() {
    setTarget(null);
    setForm(example);
    setAttested(false);
    setReviewReason('');
    setError('');
    if (sourceDetails.current) sourceDetails.current.open = false;
  }

  function validateForm() {
    const errors = validateReference({
      ...current,
      verification_status: 'draft',
      verified_at: null,
    });
    if (!errors.length) return true;
    const labels = {
      material_name: 'Nama material',
      specification: 'Spesifikasi',
      unit: 'Satuan',
      reference_code: 'Kode referensi',
      source_name: 'Nama dokumen sumber',
    };
    setError(
      errors
        .map((text) =>
          Object.entries(labels).reduce(
            (message, [key, label]) => message.replace(key, label),
            text
          )
        )
        .join('; ')
    );
    const fields = [
      [/material_name/i, 'material_name'],
      [/specification/i, 'specification'],
      [/Satuan/i, 'unit'],
      [/reference_code/i, 'reference_code'],
      [/source_name/i, 'source_name'],
      [/Harga acuan/i, 'reference_price'],
      [/URL/i, 'source_url'],
      [/Tahun/i, 'effective_year'],
      [/Jenis harga/i, 'price_type'],
      [/pajak/i, 'tax_inclusion'],
    ];
    const firstField = fields.find(([pattern]) => errors.some((text) => pattern.test(text)))?.[1];
    if (errors.some((text) => /reference_code|source_name|URL|Tahun|Jenis harga|pajak/i.test(text)))
      sourceDetails.current.open = true;
    requestAnimationFrame(() => formRef.current?.elements.namedItem(firstField)?.focus());
    return false;
  }

  async function runSave(mode) {
    if (busy) return;
    setError('');
    setMessage('');
    if (mode !== 'import' && !validateForm()) return;
    if (mode === 'verify' && !attested) {
      setError('Periksa dokumen sumber dan centang pernyataan verifikasi.');
      return;
    }
    try {
      const rows = mode === 'import' ? importRows : preparePriceImport([current]);
      if (mode === 'create' || mode === 'import') checkReferenceConflicts(rows, references);
      if (mode === 'edit_draft') checkReferenceConflicts(rows, references, target?.id);
      const possible = findPossibleDuplicates(rows, references, target?.id);
      if (mode !== 'verify' && possible.length && reviewReason.trim().length < 15) {
        setError('Tinjau kemungkinan duplikat dan isi alasan minimal 15 karakter.');
        return;
      }
      setBusy(true);
      const options = { references, reviewReason: reviewReason.trim() };
      let result;
      if (mode === 'import') result = await importPriceReferences(rows, options);
      if (mode === 'create') result = await savePriceReferences(rows[0], options);
      if (mode === 'edit_draft')
        result = await editDraftPriceReference(rows[0], target.id, options);
      if (mode === 'verify') result = await verifyPriceReference(rows[0], target.id, attested);
      await onReload();
      if (result.unchanged && !result.created && !result.edited && !result.verified)
        setMessage('Referensi sudah tersedia. Tidak ada perubahan yang dilakukan.');
      else if (mode === 'import')
        setMessage(
          `${result.created} referensi baru tersimpan sebagai Draft. ${result.unchanged} sudah tersedia dan tidak diubah.`
        );
      else if (mode === 'verify') setMessage('Referensi berhasil diverifikasi oleh admin.');
      else if (mode === 'edit_draft') setMessage('Perubahan Draft disimpan.');
      else setMessage('Referensi tersimpan sebagai Draft.');
      if (mode === 'import') setImportRows(null);
      else if (result.created || result.edited || result.verified) resetForm();
    } catch (cause) {
      setError(cause.message);
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
        tahun dan pajak. Domain resmi saja tidak membuktikan nominalnya benar. HSPK tidak dimasukkan
        ke chart harga material.
      </p>
      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          runSave(target ? 'edit_draft' : 'create');
        }}
      >
        <h3>Informasi material</h3>
        <p className="pricing-note">
          Contoh isian yang dapat diganti: Rp1.960 per kg. Contoh ini belum memiliki sumber dan
          belum diverifikasi.
        </p>
        {target && (
          <div className="pricing-review-context" role="status">
            Meninjau Draft {target.reference_code} · {target.effective_year}. Simpan perubahan Draft
            terlebih dahulu jika metadata perlu diperbaiki.
            <button type="button" disabled={busy} onClick={resetForm}>
              Batal meninjau
            </button>
          </div>
        )}
        <div className="pricing-form-grid">
          <label>
            Nama material
            <input
              name="material_name"
              required
              value={form.material_name}
              onChange={(e) => updateForm('material_name', e.target.value)}
            />
          </label>
          <label>
            Spesifikasi
            <input
              name="specification"
              required
              value={form.specification}
              onChange={(e) => updateForm('specification', e.target.value)}
            />
          </label>
          <label>
            Satuan
            <select
              name="unit"
              value={form.unit}
              onChange={(e) => updateForm('unit', e.target.value)}
            >
              {supportedPriceUnits.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
          <label>
            Harga acuan (Rp)
            <input
              name="reference_price"
              required
              type="number"
              min="0.01"
              step="any"
              value={form.reference_price}
              onChange={(e) => updateForm('reference_price', e.target.value)}
            />
          </label>
        </div>
        <details ref={sourceDetails} className="pricing-source-details">
          <summary>Detail Sumber</summary>
          <div className="pricing-form-grid">
            {sourceFields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  required
                  type={key === 'source_url' ? 'url' : key === 'effective_year' ? 'number' : 'text'}
                  min={key === 'effective_year' ? 2000 : undefined}
                  max={key === 'effective_year' ? 2100 : undefined}
                  value={form[key]}
                  onChange={(e) => updateForm(key, e.target.value)}
                />
              </label>
            ))}
            <label>
              Jenis harga
              <select
                name="price_type"
                value={form.price_type}
                onChange={(e) => updateForm('price_type', e.target.value)}
              >
                <option value="SSH">SSH</option>
                <option value="HSPK">HSPK</option>
              </select>
            </label>
            <label>
              PPN
              <select
                name="tax_inclusion"
                value={form.tax_inclusion}
                onChange={(e) => updateForm('tax_inclusion', e.target.value)}
              >
                <option value="unknown">Belum diketahui</option>
                <option value="excluded">Sebelum PPN</option>
                <option value="included">Termasuk PPN</option>
              </select>
            </label>
          </div>
        </details>
        {target && (
          <label className="pricing-check">
            <input
              type="checkbox"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
            />
            Saya telah mencocokkan nominal, spesifikasi, satuan, kode, tahun, pajak dan dokumen
            sumber.
          </label>
        )}
        {formWarnings.length > 0 && (
          <div className="pricing-conflict" role="status">
            <strong>
              Kemungkinan duplikat material. Tinjau kedua referensi sebelum melanjutkan.
            </strong>
            {formWarnings.map(({ incoming, existing }, index) => (
              <p key={index}>
                Baru: {incoming.material_name} · {incoming.reference_code || 'kode belum diisi'} ·{' '}
                {rupiah(incoming.reference_price)}. Sudah ada: {existing.material_name} ·{' '}
                {existing.reference_code} · {rupiah(existing.reference_price)}.
              </p>
            ))}
          </div>
        )}
        {formWarnings.length > 0 && (
          <label>
            Alasan kedua referensi berbeda
            <textarea
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value)}
              minLength={15}
            />
          </label>
        )}
        <div className="pricing-actions">
          <button type="submit" disabled={busy}>
            {target ? 'Simpan perubahan Draft' : 'Simpan sebagai Draft'}
          </button>
          {target && (
            <button type="button" disabled={busy} onClick={() => runSave('verify')}>
              Verifikasi referensi
            </button>
          )}
        </div>
      </form>
      <label>
        Import JSON (maks. 200 item, 1 MB)
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files[0];
            setImportRows(null);
            setError('');
            setMessage('');
            setReviewReason('');
            if (!file) return;
            try {
              if (file.size > 1000000) throw new Error('File maksimal 1 MB.');
              setImportRows(preparePriceImport(JSON.parse(await file.text())));
            } catch (cause) {
              setError(cause.message);
            }
          }}
        />
      </label>
      <p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            try {
              setImportRows(preparePriceImport(verifiedPrices));
              setError('');
              setMessage('');
              setReviewReason('');
            } catch (cause) {
              setError(cause.message);
            }
          }}
        >
          Pratinjau 2 referensi Perbup 27/2025 sebagai draft
        </button>
      </p>
      {importRows && (
        <div className="pricing-import-preview">
          <pre>{JSON.stringify(importRows, null, 2)}</pre>
          {importWarnings.length > 0 && (
            <div className="pricing-conflict" role="status">
              <strong>Kemungkinan duplikat dalam impor. Tinjau sebelum menyimpan.</strong>
              {importWarnings.map(({ incoming, existing }, index) => (
                <p key={index}>
                  Baru: {incoming.material_name} · {incoming.reference_code} ·{' '}
                  {rupiah(incoming.reference_price)}. Pembanding: {existing.material_name} ·{' '}
                  {existing.reference_code} · {rupiah(existing.reference_price)}.
                </p>
              ))}
            </div>
          )}
          {importWarnings.length > 0 && (
            <label>
              Alasan referensi memang berbeda
              <textarea
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                minLength={15}
              />
            </label>
          )}
          <button type="button" disabled={busy} onClick={() => runSave('import')}>
            Import {importRows.length} referensi sebagai Draft
          </button>
          <p className="pricing-note">
            Status Verified dari JSON diabaikan. Seluruh file ditolak jika satu baris konflik;
            referensi lama tidak berubah.
          </p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="pricing-scroll" role="region" aria-label="Daftar harga acuan" tabIndex={0}>
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
            {references.map((reference) => (
              <tr key={reference.id ?? `${reference.reference_code}-${reference.effective_year}`}>
                <td>
                  {reference.material_name}
                  <br />
                  {reference.specification}
                </td>
                <td>
                  {rupiah(reference.reference_price)} / {reference.unit}
                </td>
                <td>
                  {reference.effective_year} · {reference.tax_inclusion}
                </td>
                <td>
                  <a href={reference.source_url} target="_blank" rel="noreferrer">
                    {reference.reference_code}
                  </a>
                  <br />
                  {reference.verification_status}
                  <br />
                  {reference.verified_at}
                  {reference.verification_status === 'draft' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setTarget(reference);
                        setForm({ ...reference });
                        setAttested(false);
                        setReviewReason('');
                        setError('');
                        setMessage('');
                        if (sourceDetails.current) sourceDetails.current.open = true;
                        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      Tinjau &amp; verifikasi
                    </button>
                  )}
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
