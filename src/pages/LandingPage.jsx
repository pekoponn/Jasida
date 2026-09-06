import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { listReportsFeed } from '../lib/reports.js';
import { damageTypeDisplayLabel } from '../ai/hazardScore.js';
import { findKecamatan, getKecamatanGeoJSON } from '../lib/kecamatanBoundaries.js';
import brandLogo from '../assets/brand-logo.png';
import heroIllustration from '../assets/hero-illustration.png';

const DEFAULT_CENTER = [-7.4558, 112.6817];
const DEFAULT_ZOOM = 10;

function colorForScore(score) {
  if (score == null) return '#f8f9fa';
  if (score < 33) return '#F5D0D0'; 
  if (score < 66) return '#E08E8E'; 
  return '#C85D5D';                 
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
      dashArray: '3'
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
  }

  return (
    <div style={page}>
      <style>{`
        .kecamatan-label {
          background: transparent; border: none; box-shadow: none;
          font-size: 10px; font-weight: 600; color: #4A0000;
          text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
        }
        .kecamatan-label::before { display: none; }
      `}</style>

      {/* HEADER / NAVBAR */}
      <header style={headerBar}>
        <div style={brandRow}>
          <img src={brandLogo} alt="Jasida Logo" style={{ height: 44 }} /> 
        </div>
        <nav style={navRow}>
          <a href="#beranda" style={navLink}>Beranda</a>
          <Link to="/dashboard" style={navLink}>Daftar Laporan</Link>
          <Link to="/lapor" style={navLink}>Laporkan</Link>
          <Link to="/login" style={ctaPill}>Daftar Sekarang</Link>
        </nav>
      </header>

      {/* HERO SECTION */}
      <section id="beranda" style={heroSection}>
        <div style={heroContainer}>
          <div style={heroText}>
            <h1 style={heroTitle}>
              Jalan <span style={{ color: '#A61C24' }}>Rusak</span> Mengancam?<br />
              Lapor Cepat, Tindak Cermat.
            </h1>
            <p style={heroSubtitle}>
              Platform pelaporan infrastruktur berbasis Artificial Intelligence di Sidoarjo.
              Bantu pemerintah mendeteksi titik bahaya secara real-time demi keselamatan perjalanan warga.
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 28 }}>
              <Link to="/lapor" style={primaryBtn}>Mulai Lapor</Link>
              <a href="#peta" style={outlineBtn}>Pantau Peta</a>
            </div>
          </div>
          <div style={heroImageWrap}>
            <img src={heroIllustration} alt="Ilustrasi Jasida" style={{ width: '100%', maxWidth: 480, height: 'auto' }} />
          </div>
        </div>
      </section>

      {/* BAGAIMANA JASIDA BEKERJA */}
      <section style={howSection}>
        <h2 style={sectionTitle}>
          <span style={{ color: '#A61C24' }}>Bagaimana</span> Jasida Bekerja?
        </h2>
        <div style={stepsGrid}>
          <StepCard 
            number={1} 
            title="Ambil Foto" 
            desc="Potret kerusakan jalan di sekitarmu langsung menggunakan smartphone." 
          />
          <StepCard 
            number={2} 
            title="Deteksi AI" 
            desc="Sistem otomatis menganalisis tingkat keparahan lubang atau retakan jalan." 
          />
          <StepCard 
            number={3} 
            title="Pantau Perbaikan" 
            desc="Laporan langsung masuk ke peta publik dan dikawal hingga tuntas." 
          />
        </div>
      </section>

      {/* MAP SECTION */}
      <section id="peta" style={mapSection}>
        <h2 style={sectionTitle}>
          Peta Persebaran <span style={{ color: '#A61C24' }}>Titik Darurat</span> Sidoarjo
        </h2>
        <p style={sectionSubtitle}>
          Setiap titik merah di peta adalah laporan warga yang siap ditindaklanjuti.<br/>
          Cek wilayahmu dan pastikan jalanan sekitarmu aman.
        </p>

        {!loading && (
          <div style={mapBox}>
            <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap contributors"
              />
              <GeoJSON data={kecamatanGeoJSON} style={styleFeature} onEachFeature={onEachFeature} />
              {reports.filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number').map((r) => (
                <CircleMarker
                  key={r.id}
                  center={[r.lat, r.lng]}
                  radius={8}
                  pathOptions={{ color: '#fff', weight: 2, fillColor: '#A61C24', fillOpacity: 0.9 }}
                >
                  <Popup minWidth={180}>
                    {r.imageUrl && (
                      <img src={r.imageUrl} alt="" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }} />
                    )}
                    <div style={{ fontWeight: 700 }}>{damageTypeDisplayLabel(r.damage_type)}</div>
                    <div style={{ fontSize: 12 }}>Skor {r.hazard_score}</div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        )}

        <div style={legendRow}>
          <LegendDot color="#C85D5D" label="Sangat Parah" />
          <LegendDot color="#E08E8E" label="Kerusakan Sedang" />
          <LegendDot color="#F5D0D0" label="Kerusakan Ringan" />
        </div>
      </section>
    </div>
  );
}

function StepCard({ number, title, desc }) {
  return (
    <div style={stepCard}>
      <div style={stepNumberWrap}>
        <div style={stepNumber}>{number}.</div>
        <h3 style={{ fontSize: 16, margin: 0, fontWeight: 600, color: '#333' }}>{title}</h3>
      </div>
      <p style={{ fontSize: 14, color: '#555', margin: 0, lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: '#333' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </div>
  );
}

const page = { 
  width: '100%', 
  fontFamily: 'Inter, sans-serif', 
  color: '#111',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  cursor: 'default'
};

const headerBar = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 5%', background: '#fff', 
  borderBottom: '1.5px dashed #E5A3A3'
};
const brandRow = { display: 'flex', alignItems: 'center' };
const navRow = { display: 'flex', alignItems: 'center', gap: 32 };
const navLink = { fontSize: 15, fontWeight: 500, color: '#333', textDecoration: 'none', cursor: 'pointer' };
const ctaPill = {
  fontSize: 15, fontWeight: 600, color: '#A61C24',
  background: '#FDECEE', padding: '10px 22px', borderRadius: 8, textDecoration: 'none',
  cursor: 'pointer'
};

const heroSection = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '60px 5%', background: '#fff', minHeight: 'calc(100vh - 120px)'
};

const heroContainer = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 48, width: '100%', maxWidth: 1240, flexWrap: 'wrap'
};

const heroText = { flex: '1 1 520px', maxWidth: 620 };
const heroTitle = { fontSize: 48, lineHeight: 1.25, margin: 0, fontWeight: 700 };
const heroSubtitle = { fontSize: 17, color: '#555', marginTop: 20, lineHeight: 1.6 };
const heroImageWrap = { flex: '1 1 380px', display: 'flex', justifyContent: 'flex-end' };

const primaryBtn = {
  padding: '14px 32px', borderRadius: 28, background: '#A61C24',
  color: '#fff', fontWeight: 600, fontSize: 15, textDecoration: 'none',
  cursor: 'pointer'
};
const outlineBtn = {
  padding: '14px 32px', borderRadius: 28, border: '1.5px solid #A61C24',
  color: '#A61C24', background: '#fff', fontWeight: 600, fontSize: 15, textDecoration: 'none',
  cursor: 'pointer'
};

const howSection = { padding: '80px 5%', background: '#FFF5F5' };
const sectionTitle = { fontSize: 32, fontWeight: 700, textAlign: 'center', margin: 0 };
const sectionSubtitle = { fontSize: 15, color: '#666', textAlign: 'center', maxWidth: 600, margin: '14px auto 0', lineHeight: 1.5 };

const stepsGrid = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 28, maxWidth: 1100, margin: '48px auto 0'
};
const stepCard = {
  background: '#fff', padding: 28, display: 'flex', flexDirection: 'column', gap: 14,
  boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 8
};
const stepNumberWrap = { display: 'flex', alignItems: 'center', gap: 12 };
const stepNumber = {
  width: 38, height: 38, borderRadius: '50%', border: '1px dashed #ccc',
  color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontWeight: 600, fontSize: 15
};

const mapSection = { padding: '80px 5%', background: '#fff' };
const mapBox = { 
  maxWidth: 1100, margin: '40px auto 24px', height: 460, 
  borderRadius: 16, overflow: 'hidden', border: '2px dashed #A61C24' 
};
const legendRow = { display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap', marginTop: 24 };