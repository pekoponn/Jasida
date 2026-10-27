import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { fetchPriceReferences } from '../lib/priceCatalog.js';
import { compareMaterial, evaluateCosts, materialComposition } from '../lib/materialPricing.js';
import { rupiah } from './MaterialEditor.jsx';
import PriceReferenceCatalog from './PriceReferenceCatalog.jsx';
const colors = ['#A61C24', '#e28d53', '#436b86', '#aa7eac', '#71856a'];
const percent = (n) =>
  n == null ? 'Belum terdefinisi' : `${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
function MaterialTooltip({ active, payload }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="pricing-tooltip">
      <strong>{row.name}</strong>
      <p>
        {row.specification} · per {row.unit}
      </p>
      <p>
        Estimasi: {rupiah(row.estimate)}
        <br />
        Acuan: {rupiah(row.referencePrice)}
        <br />
        Selisih: {rupiah(row.difference)}
        <br />
        Deviasi: {percent(row.deviation)}
      </p>
      <p>
        {row.reference.source_name}
        <br />
        {row.reference.reference_code} · {row.reference.effective_year}
        <br />
        Diverifikasi: {row.reference.verified_at}
      </p>
      {row.sameSource && <p>Harga berasal dari acuan yang sama; bukan validasi independen.</p>}
    </div>
  );
}
export default function MaterialCostAnalysis({ reports }) {
  const [references, setReferences] = useState([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    try {
      setReferences(await fetchPriceReferences());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const saved = reports.filter((r) => r.estimated_materials_json?.length);
  const report = saved.find((r) => r.id === selected) ?? saved[0];
  const year =
    report?.estimate_details?.effective_year ??
    new Date(report?.estimate_recorded_at ?? report?.created_at).getFullYear();
  const rows = (report?.estimated_materials_json ?? [])
    .filter((i) => i.category === 'material')
    .map((i, index) => {
      // Prefer immutable reference captured with the estimate. Later catalog edits do not rewrite history.
      const candidates = i.reference_snapshot ? [i.reference_snapshot] : references;
      const reference = candidates.find((r) => compareMaterial(i, r, year));
      const result = compareMaterial(i, reference, year);
      return {
        ...i,
        ...result,
        label: `${i.name} (${i.unit}) #${index + 1}`,
        estimate: i.unitPrice,
        reference,
        comparable: !!result,
      };
    });
  const comparable = rows.filter((r) => r.comparable);
  const evaluation = useMemo(() => evaluateCosts(reports), [reports]);
  const composition = useMemo(() => materialComposition(reports), [reports]);
  const unclassified = reports
    .flatMap((r) => r.estimated_materials_json ?? [])
    .filter((i) => !i.category).length;
  return (
    <>
      <section className="pricing-panel" aria-label="Analisis Estimasi Material dan Harga Acuan">
        <h2>Analisis Estimasi Material dan Harga Acuan</h2>
        <p className="pricing-note">
          Confidence YOLO menunjukkan keyakinan deteksi. Kesesuaian harga mengukur deviasi terhadap
          acuan resmi. Evaluasi biaya memakai realisasi independen dari laporan yang sama. Ketiganya
          merupakan ukuran berbeda.
        </p>
        {loading && <p role="status">Memuat katalog harga…</p>}
        {error && (
          <p role="alert">
            {error} <button onClick={load}>Coba lagi</button>
          </p>
        )}
        <label>
          Laporan dengan estimasi tersimpan
          <select value={report?.id ?? ''} onChange={(e) => setSelected(e.target.value)}>
            <option value="" disabled>
              Pilih laporan
            </option>
            {saved.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code ?? r.id} · {r.address ?? r.damage_type}
              </option>
            ))}
          </select>
        </label>
        <p className="pricing-note">
          Harga per satuan sesuai label tiap material; pembanding harus cocok nama, spesifikasi,
          tahun, satuan dan dasar pajak. Konversi kg ↔ ton dan liter ↔ m³ diperbolehkan; kg ↔ m³
          atau sak ↔ kg tidak diasumsikan.
        </p>
        <div className="pricing-grid">
          <div>
            <h3>Estimasi JASIDA vs Harga Acuan Resmi</h3>
            {comparable.length ? (
              <div className="pricing-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparable}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={10} interval={0} />
                    <YAxis width={65} tickFormatter={(v) => `${v / 1000}rb`} />
                    <Tooltip content={<MaterialTooltip />} />
                    <Legend />
                    <Bar
                      isAnimationActive={false}
                      dataKey="estimate"
                      name="Estimasi JASIDA"
                      fill="#A61C24"
                    />
                    <Bar
                      isAnimationActive={false}
                      dataKey="referencePrice"
                      name="Harga Acuan Resmi Sidoarjo"
                      fill="#436b86"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p>
                Belum dapat dibandingkan. Harga acuan dengan spesifikasi, satuan, tahun dan pajak
                yang cocok belum tersedia.
              </p>
            )}
          </div>
          <div>
            <h3>Deviasi Harga Material (%)</h3>
            {comparable.length ? (
              <div
                className="pricing-chart"
                style={{ height: Math.max(300, comparable.length * 50) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparable} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" unit="%" />
                    <YAxis type="category" dataKey="label" width={120} fontSize={11} />
                    <Tooltip content={<MaterialTooltip />} />
                    <Bar
                      isAnimationActive={false}
                      dataKey="deviation"
                      name="Deviasi harga (%)"
                      fill="#A61C24"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p>Belum ada pasangan harga untuk menghitung deviasi.</p>
            )}
          </div>
        </div>
        <div className="pricing-scroll">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Material / satuan</th>
                <th>Estimasi</th>
                <th>Acuan</th>
                <th>Deviasi</th>
                <th>Kesesuaian terhadap Harga Acuan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    {r.name} / {r.unit}
                    <br />
                    {r.specification}
                  </td>
                  <td>{rupiah(r.estimate)}</td>
                  <td>
                    {r.comparable ? (
                      <>
                        {rupiah(r.referencePrice)}
                        <br />
                        <a href={r.reference.source_url} target="_blank" rel="noreferrer">
                          {r.reference.reference_code} · {r.reference.effective_year}
                        </a>
                        <br />
                        Acuan asli: {rupiah(r.reference.reference_price)} / {r.reference.unit}
                      </>
                    ) : (
                      'Belum dapat dibandingkan'
                    )}
                  </td>
                  <td>{r.comparable ? percent(r.deviation) : '—'}</td>
                  <td>
                    {r.comparable ? percent(r.score) : '—'}
                    {r.sameSource && <small>Sumber identik; bukan validasi independen.</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p>Belum ada rincian material tersimpan yang sudah diklasifikasi.</p>}
        <p className="pricing-note" title="Harga acuan harus positif.">
          Deviasi = |estimasi − acuan| / acuan × 100%. Kesesuaian = maks(0, 100 − deviasi). Nilai
          100% dari sumber harga yang sama bukan bukti akurasi harga lapangan.
        </p>
      </section>
      <section className="pricing-panel">
        <h2>Evaluasi Estimasi Biaya Lapangan</h2>
        <p>
          Jumlah pasangan valid (n): <strong>{evaluation.n}</strong>
        </p>
        {evaluation.n ? (
          <div className="pricing-metrics">
            <div>
              WAPE
              <br />
              <strong>{percent(evaluation.wape)}</strong>
            </div>
            <div>
              Skor Kesesuaian Biaya
              <br />
              <strong>{percent(evaluation.score)}</strong>
            </div>
            <div>
              MAE
              <br />
              <strong>{rupiah(evaluation.mae)}</strong>
            </div>
          </div>
        ) : (
          <p>Belum cukup data realisasi untuk mengevaluasi akurasi estimasi biaya.</p>
        )}
        <p className="pricing-note">
          WAPE = Σ|estimasi − aktual| / Σaktual × 100%; MAE = Σ|estimasi − aktual| / n. WAPE tidak
          terdefinisi bila total aktual nol. Hanya estimasi bertanggal sebelum selesai dan realisasi
          yang dikonfirmasi admin dengan bukti independen dihitung. Laporan lama tanpa bukti waktu
          atau verifikasi dikecualikan. Sampel kecil belum mewakili semua pekerjaan.
        </p>
      </section>
      <section className="pricing-panel">
        <h2>Komposisi Biaya Material</h2>
        {composition.length ? (
          <div className="pricing-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={composition}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={100}
                >
                  {composition.map((r, i) => (
                    <Cell key={r.name} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={rupiah} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p>Belum ada estimasi material tersimpan untuk ditampilkan.</p>
        )}
        <p className="pricing-note">
          Komposisi seluruh estimasi tersimpan. Biaya tenaga, alat dan lainnya tidak disertakan.{' '}
          {unclassified} rincian lama tanpa kategori dikecualikan.
        </p>
      </section>
      <PriceReferenceCatalog references={references} onReload={load} />
    </>
  );
}
