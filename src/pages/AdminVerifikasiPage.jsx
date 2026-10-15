import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminDoubleCheckPage from './AdminDoubleCheckPage.jsx';
import AdminVerifikasiLokasiPage from './AdminVerifikasiLokasiPage.jsx';
import { countPendingReviews } from '../lib/reports.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { subscribeNotifications } from '../lib/notifications.js';

const TABS = [
  { key: 'duplikat', label: 'Double Check', countKey: 'duplicate' },
  { key: 'lokasi', label: 'Verifikasi Lokasi', countKey: 'location' },
];

export default function AdminVerifikasiPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'lokasi' ? 'lokasi' : 'duplikat';
  const [counts, setCounts] = useState({ duplicate: 0, location: 0 });

  // Perbarui jumlah antrean setiap kali berpindah tab
  useEffect(() => {
    let active = true;
    countPendingReviews()
      .then((c) => active && setCounts(c))
      .catch((err) => console.warn('[count-reviews]', err.message));
    return () => {
      active = false;
    };
  }, [tab]);

  // Perbarui jumlah antrean saat ada notifikasi baru masuk
  useEffect(() => {
    if (!user?.id) return undefined;
    return subscribeNotifications(user.id, () => {
      countPendingReviews()
        .then(setCounts)
        .catch(() => {});
    });
  }, [user?.id]);

  return (
    <section>
      <div role="tablist" aria-label="Jenis verifikasi" style={tabRow}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = counts[t.countKey];
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setParams({ tab: t.key }, { replace: true })}
              style={active ? tabActive : tabInactive}
            >
              {t.label}
              {count > 0 && <span style={active ? badgeActive : badgeInactive}>{count}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'lokasi' ? (
        <AdminVerifikasiLokasiPage key="lokasi" />
      ) : (
        <AdminDoubleCheckPage key="duplikat" />
      )}
    </section>
  );
}

const tabRow = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 };

const tabBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 18px',
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  border: '1.5px solid #dee2e6',
  background: '#fff',
  color: '#495057',
};

const tabActive = { ...tabBase, border: '1.5px solid #A61C24', background: '#A61C24', color: '#fff' };
const tabInactive = { ...tabBase };

const badgeBase = {
  minWidth: 20,
  padding: '1px 7px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  textAlign: 'center',
};
const badgeActive = { ...badgeBase, background: '#fff', color: '#A61C24' };
const badgeInactive = { ...badgeBase, background: '#FDECEE', color: '#A61C24' };