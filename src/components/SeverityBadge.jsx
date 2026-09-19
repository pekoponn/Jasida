const SEVERITY_META = {
  aman: { label: 'Rendah', color: 'var(--sev-low)' },
  sedang: { label: 'Sedang', color: 'var(--sev-medium)' },
  darurat: { label: 'Darurat', color: 'var(--sev-emergency)' },
};

export default function SeverityBadge({ severity }) {
  const meta = SEVERITY_META[severity] ?? SEVERITY_META.aman;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 16px',
        borderRadius: 999,
        background: `color-mix(in srgb, ${meta.color} 15%, white)`,
        color: meta.color,
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }}
      />
      {meta.label}
    </span>
  );
}
