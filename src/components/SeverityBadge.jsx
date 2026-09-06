const SEVERITY_META = {
  aman: { label: 'Rendah', color: 'var(--sev-low)' },
  sedang: { label: 'Sedang', color: 'var(--sev-medium)' },
  darurat: { label: 'Darurat', color: 'var(--sev-emergency)' }
};

export default function SeverityBadge({ severity, score }) {
  const meta = SEVERITY_META[severity] ?? SEVERITY_META.aman;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: meta.color,
        color: '#fff',
        fontSize: 13,
        fontWeight: 700
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
      {meta.label}
      {typeof score === 'number' && (
        <span className="mono" style={{ opacity: 0.85, fontWeight: 500 }}>· {score}</span>
      )}
    </span>
  );
}