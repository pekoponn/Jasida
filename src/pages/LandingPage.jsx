import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { listReportsFeed } from '../lib/reports.js';
import { damageTypeDisplayLabel } from '../ai/hazardScore.js';
import { findKecamatan, getKecamatanGeoJSON } from '../lib/kecamatanBoundaries.js';
import heroIllustration from '../assets/hero-illustration.png';

const DEFAULT_CENTER = [-7.4558, 112.6817];
const DEFAULT_ZOOM = 11;

function colorForScore(score) {
  if (score == null) return '#f8f9fa';
  if (score < 33) return '#F5D0D0';
  if (score < 66) return '#E08E8E';
  return '#C85D5D';
}

/* ------------------------------------------------------------------ */
/*  Animasi                                                            */
/* ------------------------------------------------------------------ */
const landingAnimCss = `
  /* ---------- Hero: satu rangkaian animasi saat halaman dibuka ---------- */
  @keyframes lp-fade-up {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes lp-slide-in-right {
    from { opacity: 0; transform: translateX(40px) scale(0.97); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes lp-float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-10px); }
  }
  .lp-hero-text > * { animation: lp-fade-up 0.7s cubic-bezier(.22,1,.36,1) backwards; }
  .lp-hero-text > *:nth-child(1) { animation-delay: 0.05s; }
  .lp-hero-text > *:nth-child(2) { animation-delay: 0.18s; }
  .lp-hero-text > *:nth-child(3) { animation-delay: 0.30s; }
  .lp-hero-img {
    animation:
      lp-slide-in-right 0.9s cubic-bezier(.22,1,.36,1) 0.15s backwards,
      lp-float 6s ease-in-out 1.2s infinite;
  }

  /* ---------- Tombol ---------- */
  .lp-btn {
    transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease,
                background-color 0.2s ease, color 0.2s ease;
  }
  .lp-btn:hover { transform: translateY(-3px); }
  .lp-btn:active { transform: scale(0.95); }
  .lp-btn:focus-visible { outline: 2px solid #A61C24; outline-offset: 3px; }
  .lp-btn-primary:hover { box-shadow: 0 8px 20px rgba(166,28,36,0.35); background-color: #8f1820 !important; }
  .lp-btn-outline:hover { background-color: #A61C24 !important; color: #fff !important; box-shadow: 0 8px 20px rgba(166,28,36,0.25); }
  .lp-btn .lp-arrow { display: inline-block; transition: transform 0.2s ease; }
  .lp-btn-primary:hover .lp-arrow { transform: translateX(4px); }
  @keyframes lp-bounce-down {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(3px); }
  }
  .lp-btn-outline:hover .lp-arrow-down { animation: lp-bounce-down 0.7s ease-in-out infinite; }

  /* ---------- Reveal saat di-scroll ---------- */
  .lp-reveal {
    opacity: 0;
    transform: translateY(26px);
    transition: opacity 0.7s cubic-bezier(.22,1,.36,1), transform 0.7s cubic-bezier(.22,1,.36,1);
    will-change: opacity, transform;
  }
  .lp-reveal.lp-fade-only { transform: none; }
  .lp-reveal.lp-in { opacity: 1; transform: none; }

  /* ---------- Kartu langkah ---------- */
  .lp-step {
    transition: transform 0.3s cubic-bezier(.22,1,.36,1), box-shadow 0.3s ease;
  }
  .lp-step:hover {
    transform: translateY(-6px);
    box-shadow: 0 16px 32px rgba(166,28,36,0.12) !important;
  }
  @keyframes lp-rotate { to { transform: rotate(360deg); } }
  .lp-step-ring { animation: lp-rotate 9s linear infinite; animation-play-state: paused; transform-origin: 50% 50%; }
  .lp-step:hover .lp-step-ring { animation-play-state: running; }
  .lp-step-num { transition: transform 0.3s cubic-bezier(.34,1.56,.64,1); }
  .lp-step:hover .lp-step-num { transform: scale(1.18); }

  /* ---------- Peta ---------- */
  @keyframes lp-shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position: 600px 0; }
  }
  .lp-map-skeleton {
    background: linear-gradient(90deg, #f1f3f5 25%, #fbe9ea 37%, #f1f3f5 63%);
    background-size: 1200px 100%;
    animation: lp-shimmer 1.6s linear infinite;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    color: #A61C24; font-weight: 600; font-size: 14px;
  }
  @keyframes lp-spin { to { transform: rotate(360deg); } }
  .lp-spinner {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2.5px solid rgba(166,28,36,0.22); border-top-color: #A61C24;
    animation: lp-spin 0.75s linear infinite;
  }
  .rw-map-box .leaflet-interactive { transition: fill-opacity 0.2s ease, stroke-width 0.2s ease; }
  .rw-map-box .leaflet-popup { animation: lp-fade-up 0.25s ease backwards; }

  /* ---------- Legenda ---------- */
  .lp-legend-item { transition: transform 0.2s ease; }
  .lp-legend-item:hover { transform: translateY(-2px); }
  .lp-legend-dot { transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s ease; }
  .lp-legend-item:hover .lp-legend-dot { transform: scale(1.3); box-shadow: 0 0 0 5px rgba(166,28,36,0.1); }

  /* ---------- Hormati preferensi pengguna ---------- */
  @media (prefers-reduced-motion: reduce) {
    .lp-hero-text > *, .lp-hero-img, .lp-step-ring, .lp-map-skeleton, .lp-spinner,
    .rw-map-box .leaflet-popup { animation: none !important; }
    .lp-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
    .lp-btn, .lp-step, .lp-step-num, .lp-legend-item, .lp-legend-dot { transition: none !important; }
  }
`;

/* Muncul halus saat elemen masuk layar. */
function Reveal({ children, delay = 0, fadeOnly = false, style }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`lp-reveal${fadeOnly ? ' lp-fade-only' : ''}${shown ? ' lp-in' : ''}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listReportsFeed()
      .then(setReports)
      .catch((err) => console.warn('[landing-map]', err.message))
      .finally(() => setLoading(false));
  }, []);

  // Scroll halus untuk tombol "Pantau Peta" (hanya selama halaman ini aktif)
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'smooth';
    return () => {
      root.style.scrollBehavior = prev;
    };
  }, []);

  const kecamatanStats = useMemo(() => {
    const raw = {};
    reports.forEach((r) => {
      if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return;
      const nama = findKecamatan(r.lat, r.lng);
      if (!nama) return;
      if (!raw[nama]) raw[nama] = { total: 0, count: 0 };
      raw[nama].total += r.hazard_score ?? 0;
      raw[nama].count += 1;
    });
    const result = {};
    Object.entries(raw).forEach(([nama, { total, count }]) => {
      result[nama] = { avgScore: Math.round(total / count), count };
    });
    return result;
  }, [reports]);

  const kecamatanGeoJSON = useMemo(() => getKecamatanGeoJSON(), []);

  function styleFeature(feature) {
    const stat = kecamatanStats[feature.properties.kecamatan];
    return {
      fillColor: colorForScore(stat?.avgScore),
      fillOpacity: 0.6,
      color: '#A61C24',
      weight: 1,
      dashArray: '3',
    };
  }

  function onEachFeature(feature, layer) {
    const nama = feature.properties.kecamatan;
    const stat = kecamatanStats[nama];
    layer.bindTooltip(nama, { permanent: true, direction: 'center', className: 'kecamatan-label' });
    layer.bindPopup(
      stat
        ? `<strong>${nama}</strong><br/>Skor rata-rata: ${stat.avgScore}<br/>${stat.count} laporan`
        : `<strong>${nama}</strong><br/>Belum ada laporan`
    );
    // Sorot wilayah saat kursor lewat
    layer.on({
      mouseover: (e) => e.target.setStyle({ fillOpacity: 0.88, weight: 2.2, dashArray: '' }),
      mouseout: (e) => e.target.setStyle(styleFeature(feature)),
    });
  }

  return (
    <div style={page}>
      <style>{landingAnimCss}</style>
      <style>{leafletZIndexFixCss}</style>

      {/* HERO SECTION */}
      <section id="beranda" className="rw-hero-section" style={heroSection}>
        <div className="rw-hero-container">
          <div className="rw-hero-text lp-hero-text">
            <h1 className="rw-hero-title" style={heroTitle}>
              Jalan <span style={{ color: '#A61C24' }}>Rusak</span> Mengancam?
              <br />
              Lapor Cepat, Tindak Cermat.
            </h1>
            <p className="rw-hero-subtitle" style={heroSubtitle}>
              Platform pelaporan infrastruktur berbasis Artificial Intelligence di Sidoarjo. Bantu
              pemerintah mendeteksi titik bahaya secara real-time demi keselamatan perjalanan warga.
            </p>
            <div className="rw-hero-buttons" style={{ marginTop: 28 }}>
              <Link to="/lapor" className="lp-btn lp-btn-primary" style={primaryBtn}>
                Mulai Lapor
                <span className="lp-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
              <a href="#peta" className="lp-btn lp-btn-outline" style={outlineBtn}>
                Pantau Peta
                <span className="lp-arrow lp-arrow-down" aria-hidden="true">
                  ↓
                </span>
              </a>
            </div>
          </div>
          <div className="rw-hero-image">
            <img
              src={heroIllustration}
              alt="Ilustrasi Jasida"
              className="lp-hero-img"
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
        </div>
      </section>

      {/* BAGAIMANA JASIDA BEKERJA */}
      <section className="rw-section-padding" style={howSection}>
        <Reveal>
          <h2 className="rw-section-title" style={sectionTitle}>
            <span style={{ color: '#A61C24' }}>Bagaimana</span> Jasida Bekerja?
          </h2>
        </Reveal>
        <div style={stepsGrid}>
          <Reveal delay={0} style={{ height: '100%' }}>
            <StepCard
              number={1}
              title="Ambil Foto"
              desc="Potret kerusakan jalan di sekitarmu langsung menggunakan smartphone."
            />
          </Reveal>
          <Reveal delay={140} style={{ height: '100%' }}>
            <StepCard
              number={2}
              title="Deteksi AI"
              desc="Sistem otomatis menganalisis tingkat keparahan lubang atau retakan jalan."
            />
          </Reveal>
          <Reveal delay={280} style={{ height: '100%' }}>
            <StepCard
              number={3}
              title="Pantau Perbaikan"
              desc="Laporan langsung masuk ke peta publik dan dikawal hingga tuntas."
            />
          </Reveal>
        </div>
      </section>

      {/* MAP SECTION */}
      <section id="peta" className="rw-section-padding" style={mapSection}>
        <Reveal>
          <h2 className="rw-section-title" style={sectionTitle}>
            Peta Persebaran <span style={{ color: '#A61C24' }}>Titik Darurat</span> Sidoarjo
          </h2>
          <p className="rw-section-subtitle" style={sectionSubtitle}>
            Setiap titik merah di peta adalah laporan warga yang siap ditindaklanjuti.
            <br />
            Cek wilayahmu dan pastikan jalanan sekitarmu aman.
          </p>
        </Reveal>

        {loading ? (
          <div className="rw-map-box lp-map-skeleton" style={mapBox} role="status">
            <span className="lp-spinner" aria-hidden="true" />
            Memuat peta…
          </div>
        ) : (
          <Reveal fadeOnly>
            <div className="rw-map-box" style={mapBox}>
              <MapContainer
                center={DEFAULT_CENTER}
                zoom={DEFAULT_ZOOM}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="© OpenStreetMap contributors"
                />
                <GeoJSON
                  data={kecamatanGeoJSON}
                  style={styleFeature}
                  onEachFeature={onEachFeature}
                />
                {reports
                  .filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number')
                  .map((r) => (
                    <CircleMarker
                      key={r.id}
                      center={[r.lat, r.lng]}
                      radius={8}
                      pathOptions={{
                        color: '#fff',
                        weight: 2,
                        fillColor: '#A61C24',
                        fillOpacity: 0.9,
                      }}
                      eventHandlers={{
                        mouseover: (e) => e.target.setRadius(11),
                        mouseout: (e) => e.target.setRadius(8),
                      }}
                    >
                      <Popup minWidth={180}>
                        {r.imageUrl && (
                          <img
                            src={r.imageUrl}
                            alt=""
                            style={{
                              width: '100%',
                              maxHeight: 120,
                              objectFit: 'cover',
                              borderRadius: 6,
                              marginBottom: 6,
                            }}
                          />
                        )}
                        <div style={{ fontWeight: 700 }}>
                          {damageTypeDisplayLabel(r.damage_type)}
                        </div>
                        <div style={{ fontSize: 12 }}>Skor {r.hazard_score}</div>
                      </Popup>
                    </CircleMarker>
                  ))}
              </MapContainer>
            </div>
          </Reveal>
        )}

        <div className="rw-legend-row" style={legendRow}>
          <Reveal delay={0}>
            <LegendDot color="#C85D5D" label="Sangat Parah" />
          </Reveal>
          <Reveal delay={100}>
            <LegendDot color="#E08E8E" label="Kerusakan Sedang" />
          </Reveal>
          <Reveal delay={200}>
            <LegendDot color="#F5D0D0" label="Kerusakan Ringan" />
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function StepCard({ number, title, desc }) {
  return (
    <div className="lp-step" style={{ ...stepCard, height: '100%', boxSizing: 'border-box' }}>
      <div style={stepNumberWrap}>
        <div className="lp-step-num" style={stepNumberCircle}>
          <svg
            className="lp-step-ring"
            width="38"
            height="38"
            viewBox="0 0 38 38"
            style={{ position: 'absolute', top: 0, left: 0 }}
            aria-hidden="true"
          >
            <circle
              cx="19"
              cy="19"
              r="17"
              fill="none"
              stroke="#A61C24"
              strokeWidth="1.5"
              strokeDasharray="8.7 4.6"
            />
          </svg>
          <span style={stepNumberText}>{number}.</span>
        </div>
        <h3 style={{ fontSize: 16, margin: 0, fontWeight: 600, color: '#333' }}>{title}</h3>
      </div>
      <p style={{ fontSize: 14, color: '#555', margin: 0, lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div
      className="lp-legend-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        fontWeight: 500,
        color: '#333',
      }}
    >
      <span
        className="lp-legend-dot"
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      {label}
    </div>
  );
}

const page = {
  width: '100%',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: '#111',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  cursor: 'default',
};

const heroSection = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 5%',
  background: '#fff',
  overflow: 'hidden',
};

const heroTitle = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: 48,
  lineHeight: '55px',
  margin: 0,
  fontWeight: 600,
};

const heroSubtitle = { fontSize: 17, color: '#555', marginTop: 20, lineHeight: 1.6 };

const primaryBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '14px 32px',
  borderRadius: 28,
  background: '#A61C24',
  color: '#fff',
  fontWeight: 600,
  fontSize: 15,
  textDecoration: 'none',
  cursor: 'pointer',
};

const outlineBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '14px 32px',
  borderRadius: 28,
  border: '1.5px solid #A61C24',
  color: '#A61C24',
  background: '#fff',
  fontWeight: 600,
  fontSize: 15,
  textDecoration: 'none',
  cursor: 'pointer',
};

const howSection = { padding: '80px 5%', background: '#FFF5F5' };
const sectionTitle = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: 32,
  fontWeight: 700,
  textAlign: 'center',
  margin: 0,
};
const sectionSubtitle = {
  fontSize: 15,
  color: '#666',
  textAlign: 'center',
  maxWidth: 600,
  margin: '14px auto 0',
  lineHeight: 1.5,
};

const stepsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 28,
  maxWidth: 1100,
  margin: '48px auto 0',
};

const stepCard = {
  background: '#fff',
  padding: 28,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
  borderRadius: 8,
};

const stepNumberWrap = { display: 'flex', alignItems: 'center', gap: 12 };
const stepNumberCircle = {
  position: 'relative',
  width: 38,
  height: 38,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const stepNumberText = {
  position: 'relative',
  zIndex: 1,
  color: '#A61C24',
  fontWeight: 700,
  fontSize: 15,
};

const mapSection = { padding: '80px 5% 100px', background: '#fff' };
const mapBox = {
  maxWidth: 1100,
  margin: '40px auto 24px',
  height: 460,
  borderRadius: 16,
  overflow: 'hidden',
  border: '2px dashed #A61C24',
  position: 'relative',
  isolation: 'isolate',
};

const leafletZIndexFixCss = `
  .rw-map-box .leaflet-top,
  .rw-map-box .leaflet-bottom,
  .rw-map-box .leaflet-control-container {
    z-index: 400;
  }
`;
const legendRow = {
  display: 'flex',
  justifyContent: 'center',
  gap: 40,
  flexWrap: 'wrap',
  marginTop: 24,
};