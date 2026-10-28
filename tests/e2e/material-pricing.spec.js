import { test, expect, login } from './fixtures.js';
const reference = {
  material_name: 'Aspal hotmix',
  specification: 'AC-WC',
  unit: 'kg',
  reference_price: 2000,
  reference_code: 'TEST-ONLY',
  source_name: 'Fixture harga uji',
  source_url: 'https://rds.sidoarjokab.go.id/',
  effective_year: 2026,
  verified_at: '2026-01-01T00:00:00Z',
  price_type: 'SSH',
  tax_inclusion: 'excluded',
  verification_status: 'verified',
};
const report = {
  id: '00000000-0000-4000-8000-000000000002',
  created_at: '2026-01-01',
  damage_type: 'pothole',
  status: 'resolved',
  hazard_score: 70,
  severity: 'darurat',
  lat: -7.4478,
  lng: 112.7183,
  location_status: 'trusted',
  estimated_cost: 18000,
  actual_cost: 20000,
  estimate_recorded_at: '2026-01-01',
  resolved_at: '2026-01-02',
  actual_cost_verified: true,
  actual_cost_evidence: 'NOTA-TEST',
  estimate_details: { effective_year: 2026 },
  estimated_materials_json: [
    {
      name: 'Aspal hotmix',
      specification: 'AC-WC',
      unit: 'kg',
      unitPrice: 1800,
      quantity: 10,
      category: 'material',
      tax_inclusion: 'excluded',
    },
  ],
};
test('saved material comparison, WAPE, donut and responsive charts use real fixture pairs', async ({
  page,
  backend,
}, testInfo) => {
  backend.role = 'admin';
  backend.reports = [report];
  backend.priceReferences = [reference];
  await login(page);
  await page.goto('/admin/statistik');
  await expect(
    page.getByRole('heading', { name: 'Analisis Estimasi Material dan Harga Acuan' })
  ).toBeVisible();
  await expect(page.locator('.pricing-metrics')).toContainText('10%');
  await expect(page.locator('.pricing-metrics')).toContainText('90%');
  await expect(page.locator('.pricing-metrics')).toContainText('Rp2.000');
  await expect(page.locator('.pricing-chart svg').first()).toBeVisible();
  await page
    .getByRole('region', { name: 'Analisis Estimasi Material dan Harga Acuan' })
    .screenshot({ path: testInfo.outputPath('material-charts-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator('.pricing-chart')
        .first()
        .evaluate((el) =>
          Math.abs(
            el.querySelector('.recharts-wrapper > svg').getBoundingClientRect().width -
              el.getBoundingClientRect().width
          )
        )
    )
    .toBeLessThan(2);
  await page
    .getByRole('region', { name: 'Analisis Estimasi Material dan Harga Acuan' })
    .screenshot({ path: testInfo.outputPath('material-charts-mobile.png') });
  await expect(page.locator('.pricing-chart svg').first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  ).toBe(true);
});
test('empty catalog and no evaluation pairs show honest empty states', async ({
  page,
  backend,
}) => {
  backend.role = 'admin';
  await login(page);
  await page.goto('/admin/statistik');
  await expect(
    page.getByText('Belum cukup data realisasi untuk mengevaluasi akurasi estimasi biaya.')
  ).toBeVisible();
  await expect(page.getByText('Belum dapat dibandingkan.', { exact: false })).toBeVisible();
  await page.getByText('Katalog harga acuan resmi — input / import admin', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Pratinjau 2 referensi Perbup 27/2025 sebagai draft' })
    .click();
  await page.getByRole('button', { name: 'Import 2 referensi sebagai draft' }).click();
  await expect(page.getByRole('status')).toContainText('Referensi baru disimpan sebagai draft');
  const saved = backend.writes.find((w) => w.type === 'catalog').data;
  expect(saved).toHaveLength(2);
  expect(saved.every((r) => r.verification_status === 'draft' && r.verified_at === null)).toBe(
    true
  );
});

test('JSON verification is ignored; duplicate import preserves existing verified prices', async ({
  page,
  backend,
}) => {
  backend.role = 'admin';
  backend.priceReferences = [reference];
  await login(page);
  await page.goto('/admin/statistik');
  await page.getByText('Katalog harga acuan resmi — input / import admin', { exact: true }).click();
  const picker = page.getByLabel('Import JSON (maks. 200 item, 1 MB)');
  const rows = [reference, { ...reference, reference_code: 'NEW-DRAFT' }];
  await picker.setInputFiles({
    name: 'prices.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(rows)),
  });
  await expect(page.getByText('"verification_status": "draft"').first()).toBeVisible();
  await page.getByRole('button', { name: 'Import 2 referensi sebagai draft' }).click();
  await expect(page.getByRole('status')).toContainText('Import selesai');
  expect(backend.priceReferences.find((r) => r.reference_code === 'TEST-ONLY')).toEqual(reference);
  expect(backend.priceReferences.find((r) => r.reference_code === 'NEW-DRAFT')).toMatchObject({
    verification_status: 'draft',
    verified_at: null,
  });
  await picker.setInputFiles({
    name: 'duplicate.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify([reference, reference])),
  });
  await expect(page.getByRole('alert')).toContainText('Kode dan tahun duplikat');
  await expect(page.getByRole('button', { name: 'Import 2 referensi sebagai draft' })).toHaveCount(
    0
  );
  await picker.setInputFiles({
    name: 'large.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(1000001, 32),
  });
  await expect(page.getByRole('alert')).toContainText('File maksimal 1 MB');
  await page.getByRole('button', { name: 'Tinjau & verifikasi' }).click();
  await page.getByRole('button', { name: 'Simpan harga acuan' }).click();
  await expect(page.getByRole('alert')).toContainText('centang pernyataan verifikasi');
  expect(backend.priceReferences.find((r) => r.reference_code === 'NEW-DRAFT')).toMatchObject({
    verification_status: 'draft',
  });
});
test('start work saves independently entered estimate; completion never overwrites estimate', async ({
  page,
  backend,
}) => {
  backend.role = 'admin';
  backend.reports = [
    {
      ...report,
      status: 'accepted',
      estimated_materials_json: null,
      estimated_cost: null,
      actual_cost: null,
      estimate_recorded_at: null,
      resolved_at: null,
    },
  ];
  await login(page);
  await page.goto('/admin/laporan');
  await page.getByRole('button', { name: 'Mulai Kerjakan', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Mulai Pengerjaan' });
  await expect(dialog.getByLabel('Harga satuan 1', { exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: 'Hapus baris 2' }).click();
  await dialog.getByLabel('Jumlah 1', { exact: true }).fill('10');
  await dialog.getByLabel('Harga satuan 1', { exact: true }).fill('1800');
  await dialog
    .getByLabel('Catatan metode / dasar koreksi manual')
    .fill('Pengukuran lapangan dan kebutuhan bahan diperiksa petugas.');
  await dialog.getByRole('checkbox').check();
  await dialog.getByLabel('Estimasi tanggal selesai').fill('2026-12-01');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate((el) => el.getBoundingClientRect().width <= window.innerWidth)).toBe(
    true
  );
  await dialog.getByRole('button', { name: 'Konfirmasi & Mulai Kerjakan' }).click();
  await page.getByRole('button', { name: 'Tandai Selesai', exact: true }).click();
  const complete = page.getByRole('dialog', { name: 'Tandai Selesai' });
  await expect(complete.getByLabel('Harga satuan 1', { exact: true })).toHaveValue('');
  await complete.getByLabel('Jumlah 1', { exact: true }).fill('11');
  await complete.getByLabel('Harga satuan 1', { exact: true }).fill('2000');
  await complete.getByLabel('Referensi bukti realisasi', { exact: false }).fill('NOTA-UJI-01');
  await complete.getByRole('checkbox').check();
  await complete
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'bukti.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQ0AAAAASUVORK5CYII=',
        'base64'
      ),
    });
  await complete.getByRole('button', { name: 'Simpan & Selesaikan' }).click();
  await expect(complete).not.toBeVisible();
  const writes = backend.writes.filter((w) => w.type === 'report-update');
  expect(writes[0].data.estimated_cost).toBe(18000);
  expect(writes.at(-1).data.actual_cost).toBe(22000);
  expect(writes.at(-1).data).not.toHaveProperty('estimated_cost');
  expect(writes.at(-1).data.actual_cost_verified).toBe(true);
});

test('catalog failure is recoverable and does not fabricate reference prices', async ({
  page,
  backend,
}) => {
  backend.role = 'admin';
  backend.failCatalog = true;
  await login(page);
  await page.goto('/admin/statistik');
  await expect(page.getByRole('alert')).toContainText('Katalog harga belum dapat dimuat');
  await expect(page.getByText('Belum dapat dibandingkan.', { exact: false })).toBeVisible();
  backend.failCatalog = false;
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('measured estimate changes repair materials and retains documented calculation', async ({
  page,
  backend,
}) => {
  backend.role = 'admin';
  backend.reports = [{ ...report, status: 'accepted' }];
  await login(page);
  await page.goto('/admin/laporan');
  await page.getByRole('button', { name: 'Mulai Kerjakan', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Mulai Pengerjaan' });
  await dialog
    .getByRole('combobox', { name: 'Metode perbaikan', exact: true })
    .selectOption('longitudinal');
  await expect(dialog.getByLabel('Nama 1', { exact: true })).toHaveValue('Sealant aspal');
  await expect(dialog.getByLabel('Nama 2', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Panjang (m)', { exact: true }).fill('4');
  await dialog.getByLabel('Kode analisis & halaman AHSP').fill('TEST-ONLY: koefisien simulasi tes');
  await dialog.getByLabel('URL sumber koefisien').fill('https://binakonstruksi.pu.go.id/');
  await dialog.getByLabel('Koefisien 1', { exact: true }).fill('1.5');
  await dialog.getByLabel('Harga satuan 1', { exact: true }).fill('2000');
  await dialog.getByRole('button', { name: 'Hitung dari ukuran & koefisien' }).click();
  await expect(dialog.getByLabel('Jumlah 1', { exact: true })).toHaveValue('6');
  await dialog.getByRole('checkbox').check();
  await dialog.getByLabel('Estimasi tanggal selesai').fill('2026-12-01');
  await dialog.getByRole('button', { name: 'Konfirmasi & Mulai Kerjakan' }).click();
  await expect(dialog).not.toBeVisible();
  const saved = backend.writes.find((w) => w.type === 'report-update').data;
  expect(saved.estimated_cost).toBe(12000);
  expect(saved.estimated_materials_json[0].calculation.coefficient).toBe(1.5);
  expect(saved.estimate_details.method).toBe('longitudinal');
});
