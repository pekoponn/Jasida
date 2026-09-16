import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

const JASIDA_FONT = 'Jacques Francois';

export default function Footer() {
  return (
    <footer style={footerSection}>
      {/* Layer background dengan radius membulat di pojok atas kiri & kanan */}
      <div style={footerBgLayer} />

      {/* Logo + teks "Jasida" digabung satu wrapper, center di 50% footer */}
      <div style={logoImgWrap}>
        <img src={logo} alt="Jasida Icon" style={logoImg} />
        <span style={footerLogoText}>Jasida</span>
      </div>

      {/* 3 kelompok: Kiri (Contact+Menu) - Tengah (spacer, kosong) - Kanan (Tentang+Sosial Media) */}
      <div style={footerGrid}>
        <div style={leftGroup}>
          <div>
            <h4 style={footerHeading}>Contact</h4>
            <p style={footerText}>Sekardangan, Sidoarjo</p>
            <p style={footerText}>08123456789000</p>
            <p style={footerText}>info@jasida.co.id</p>
          </div>

          <div>
            <h4 style={footerHeading}>Menu</h4>
            <p style={footerText}><Link to="/" style={footerLink}>Beranda</Link></p>
            <p style={footerText}><Link to="/dashboard" style={footerLink}>Daftar Laporan</Link></p>
            <p style={footerText}><Link to="/lapor" style={footerLink}>Laporkan</Link></p>
          </div>
        </div>

        {/* Kolom tengah dikosongkan, cuma jadi patokan titik tengah grid */}
        <div />

        <div style={rightGroup}>
          <div>
            <h4 style={footerHeading}>Tentang</h4>
            <p style={footerText}>
              Platform cerdas pelaporan jalan berbasis AI untuk mobilitas Sidoarjo yang lebih aman dan nyaman.
            </p>
          </div>

          <div>
            <h4 style={footerHeading}>Sosial Media</h4>
            <p style={footerText}><a href="#" style={footerLink}>Facebook ↗</a></p>
            <p style={footerText}><a href="#" style={footerLink}>Instagram ↗</a></p>
            <p style={footerText}><a href="#" style={footerLink}>Linkedin ↗</a></p>
          </div>
        </div>
      </div>

      {/* Pembatas Garis Patah-Patah & Copyright */}
      <div style={copyrightText}>
        © 2026 Jasida. Dikembangkan oleh Tim Saya Ganti Kimpul. Seluruh hak cipta dilindungi undang-undang.
      </div>
    </footer>
  );
}

const footerSection = {
  position: 'relative',
  padding: '28px 6% 24px',
  marginTop: 'auto',
  isolation: 'isolate'
};

const footerBgLayer = {
  position: 'absolute',
  inset: 0,
  background: '#FFF5F5',
  borderRadius: '56px 56px 0 0',
  overflow: 'hidden',
  zIndex: -1
};

const logoImgWrap = {
  position: 'absolute',
  top: -80,
  left: '50%',
  transform: 'translate(-50%, 0)',
  zIndex: 5,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none'
};

const logoImg = {
  width: 160,
  height: 'auto',
  display: 'block',
  imageRendering: 'auto',
  filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.12))'
};

const footerGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'start',
  columnGap: 150,
  maxWidth: 1200,
  margin: '0 auto',
  padding: '0 12px',
  position: 'relative',
  zIndex: 1
};

const leftGroup = {
  display: 'flex',
  gap: 80,
  justifySelf: 'end'
};

const rightGroup = {
  display: 'flex',
  gap: 80,
  justifySelf: 'start'
};

const footerLogoText = {
  fontSize: 32,
  fontWeight: 400,
  color: '#111',
  fontFamily: JASIDA_FONT,
  letterSpacing: '-0.5px',
  marginTop: 4,
  pointerEvents: 'auto'
};

const footerHeading = { 
  fontSize: 20, 
  fontWeight: 700, 
  margin: '0 0 16px', 
  color: '#111',
  fontFamily: 'Poppins, Inter, sans-serif',
  whiteSpace: 'nowrap'
};

const footerText = { 
  fontSize: 15, 
  color: '#444', 
  margin: '9px 0', 
  lineHeight: 1.7,
  fontFamily: 'Poppins, Inter, sans-serif',
  maxWidth: 260
};

const footerLink = { color: '#444', textDecoration: 'none' };

const copyrightText = {
  textAlign: 'center',
  marginTop: 32,
  paddingTop: 18,
  borderTop: '1.5px dashed #E5A3A3',
  fontSize: 13,
  color: '#A61C24',
  fontFamily: 'Poppins, Inter, sans-serif',
  position: 'relative',
  zIndex: 1
};
