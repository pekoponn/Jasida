import { useEffect, useState } from 'react';
import {
  newMaterial,
  totalItems,
  REPAIR_METHODS,
  applyCoefficients,
  AHSP_URL,
} from '../ai/materialEstimate.js';
import { fetchPriceReferences } from '../lib/priceCatalog.js';
import { validateReference } from '../lib/materialPricing.js';
import '../styles/materialPricing.css';
export const rupiah = (n) =>
  typeof n === 'number' && Number.isFinite(n)
    ? 'Rp' + n.toLocaleString('id-ID', { maximumFractionDigits: 2 })
    : '—';
export function MaterialEditor({ items, setItems, references = [], year, coefficients = false }) {
  function update(index, field, value) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [field]: value };
        if (['name', 'specification', 'unit', 'unitPrice', 'tax_inclusion'].includes(field)) {
          next.price_origin = 'manual';
          delete next.reference_snapshot;
          delete next.reference_code;
        }
        if (['quantity', 'coefficient', 'unit', 'name'].includes(field)) delete next.calculation;
        next.lineTotal = Number(next.quantity || 0) * Number(next.unitPrice || 0);
        return next;
      })
    );
  }
  function applyReference(index, code) {
    const ref = references.find((r) => r.reference_code === code && r.effective_year === year);
    if (!ref) return;
    setItems((prev) =>
      prev.map((i, n) =>
        n !== index
          ? i
          : {
              ...i,
              name: ref.material_name,
              specification: ref.specification,
              unit: ref.unit,
              unitPrice: ref.reference_price,
              lineTotal: Number(i.quantity || 0) * ref.reference_price,
              category: 'material',
              tax_inclusion: ref.tax_inclusion,
              reference_code: ref.reference_code,
              reference_snapshot: ref,
              price_origin: 'reference',
              calculation: undefined,
            }
      )
    );
  }
  const eligible = references.filter(
    (r) =>
      !validateReference(r).length &&
      r.verification_status === 'verified' &&
      r.price_type === 'SSH' &&
      r.effective_year === year
  );
  return (
    <div className="material-editor">
      <div
        className="pricing-scroll"
        role="region"
        aria-label="Rincian material dan biaya"
        tabIndex={0}
      >
        <table className="pricing-table">
          <thead>
            <tr>
              <th>Material / biaya</th>
              <th>Spesifikasi & kategori</th>
              <th>Jumlah</th>
              <th>Satuan</th>
              {coefficients && <th>Koefisien / satuan pekerjaan</th>}
              <th>Harga satuan (Rp)</th>
              <th>Subtotal</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>
                  <input
                    aria-label={`Nama ${index + 1}`}
                    value={item.name}
                    onChange={(e) => update(index, 'name', e.target.value)}
                  />
                  {eligible.length > 0 && (
                    <select
                      aria-label={`Acuan ${index + 1}`}
                      value=""
                      onChange={(e) => applyReference(index, e.target.value)}
                    >
                      <option value="">Gunakan harga acuan…</option>
                      {eligible.map((r) => (
                        <option key={r.reference_code} value={r.reference_code}>
                          {r.material_name} — {r.specification}
                        </option>
                      ))}
                    </select>
                  )}
                  <small>
                    {item.reference_snapshot ? (
                      <a href={item.reference_snapshot.source_url} target="_blank" rel="noreferrer">
                        {item.reference_code} · {item.reference_snapshot.effective_year}
                      </a>
                    ) : (
                      'Harga acuan belum tersedia / belum dipilih'
                    )}
                  </small>
                </td>
                <td>
                  <input
                    aria-label={`Spesifikasi ${index + 1}`}
                    value={item.specification ?? ''}
                    onChange={(e) => update(index, 'specification', e.target.value)}
                  />
                  <select
                    aria-label={`Kategori ${index + 1}`}
                    value={item.category ?? 'other'}
                    onChange={(e) => update(index, 'category', e.target.value)}
                  >
                    <option value="material">Material</option>
                    <option value="labor">Tenaga kerja</option>
                    <option value="equipment">Peralatan</option>
                    <option value="other">Lainnya / belum diklasifikasi</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    aria-label={`Jumlah ${index + 1}`}
                    value={item.quantity}
                    onChange={(e) =>
                      update(index, 'quantity', e.target.value === '' ? '' : Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`Satuan ${index + 1}`}
                    value={item.unit}
                    onChange={(e) => update(index, 'unit', e.target.value)}
                  />
                </td>
                {coefficients && (
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      aria-label={`Koefisien ${index + 1}`}
                      value={item.coefficient ?? ''}
                      onChange={(e) =>
                        update(
                          index,
                          'coefficient',
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                    />
                  </td>
                )}
                <td>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    aria-label={`Harga satuan ${index + 1}`}
                    value={item.unitPrice}
                    onChange={(e) =>
                      update(
                        index,
                        'unitPrice',
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                  />
                  <select
                    aria-label={`Pajak ${index + 1}`}
                    value={item.tax_inclusion ?? 'unknown'}
                    onChange={(e) => update(index, 'tax_inclusion', e.target.value)}
                  >
                    <option value="unknown">Pajak belum diketahui</option>
                    <option value="excluded">Sebelum PPN</option>
                    <option value="included">Termasuk PPN</option>
                  </select>
                </td>
                <td>
                  {item.quantity === '' || item.unitPrice === ''
                    ? 'Belum lengkap'
                    : rupiah(item.quantity * item.unitPrice)}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, i) => i !== index))}
                    aria-label={`Hapus baris ${index + 1}`}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => setItems([...items, newMaterial()])}>
        Tambah rincian biaya
      </button>
      <p>
        <strong>Total rincian terisi: {rupiah(totalItems(items))}</strong>
      </p>
      <small>
        Kelompokkan tenaga dan alat secara terpisah. Jumlah harus positif; harga nol hanya untuk
        biaya tanpa pembayaran. Samakan dasar pajak seluruh rincian estimasi dan realisasi.
      </small>
    </div>
  );
}
export function MeasuredEstimate({ details, setDetails, items, setItems }) {
  const [error, setError] = useState('');
  const update = (key, value) => {
    if (key === 'method') {
      setDetails({
        ...details,
        method: value,
        basis: REPAIR_METHODS[value].basis,
        field_verified: false,
      });
      setItems(REPAIR_METHODS[value].materials.map(newMaterial));
      return;
    }
    setDetails({ ...details, [key]: value });
    if (!['field_verified', 'notes'].includes(key))
      setItems(items.map((i) => ({ ...i, calculation: undefined })));
  };
  return (
    <fieldset className="pricing-fieldset">
      <legend>Verifikasi lapangan & metode perbaikan</legend>
      <div className="pricing-form-grid">
        <label>
          Metode perbaikan
          <select value={details.method} onChange={(e) => update('method', e.target.value)}>
            {Object.entries(REPAIR_METHODS).map(([key, m]) => (
              <option value={key} key={key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dasar volume pekerjaan
          <select value={details.basis} onChange={(e) => update('basis', e.target.value)}>
            <option value="m">Panjang (m)</option>
            <option value="m2">Luas (m²)</option>
            <option value="m3">Volume (m³)</option>
          </select>
        </label>
        {[
          ['length', 'Panjang (m)'],
          ['width', 'Lebar (m)'],
          ['area', 'Luas langsung (m²)'],
          ['depth', 'Ketebalan (m)'],
        ].map(([k, label]) => (
          <label key={k}>
            {label}
            <input
              type="number"
              min="0"
              step="any"
              value={details[k] ?? ''}
              onChange={(e) => update(k, e.target.value === '' ? '' : Number(e.target.value))}
            />
          </label>
        ))}
        <label>
          Kode analisis & halaman AHSP
          <input
            value={details.reference_code ?? ''}
            onChange={(e) => update('reference_code', e.target.value)}
          />
        </label>
        <label>
          URL sumber koefisien
          <input
            type="url"
            value={details.source_url ?? ''}
            onChange={(e) => update('source_url', e.target.value)}
          />
        </label>
      </div>
      <p className="pricing-note">
        Volume = luas × ketebalan, atau panjang untuk retak. Kebutuhan tiap bahan = volume pekerjaan
        × koefisien. Isi koefisien sesuai metode dan satuan pada{' '}
        <a href={AHSP_URL} target="_blank" rel="noreferrer">
          AHSP Bina Marga 2026
        </a>
        . Tidak ada koefisien asumsi bawaan. Tenaga/alat harus memakai koefisien dengan dasar
        pekerjaan yang sama.
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            setItems(applyCoefficients(items, details));
            setError('');
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        Hitung dari ukuran & koefisien
      </button>
      {error && <p role="alert">{error}</p>}
      <label>
        Catatan metode / dasar koreksi manual
        <textarea value={details.notes ?? ''} onChange={(e) => update('notes', e.target.value)} />
      </label>
      <label className="pricing-check">
        <input
          type="checkbox"
          checked={details.field_verified ?? false}
          onChange={(e) => update('field_verified', e.target.checked)}
        />
        Saya telah memeriksa metode, ukuran, koefisien atau koreksi jumlah berdasarkan kondisi
        lapangan.
      </label>
    </fieldset>
  );
}
export function usePriceCatalog() {
  const [references, setReferences] = useState([]),
    [catalogError, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetchPriceReferences()
      .then((r) => {
        if (active) setReferences(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return { references, catalogError };
}
