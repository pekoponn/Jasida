import { readFile } from 'node:fs/promises';
import { test, expect, login } from './fixtures.js';

async function selectPhotos(page, count) {
  const buffer = await readFile(
    new URL('../../src/assets/worker-illustration.png', import.meta.url)
  );
  await page.getByLabel('Pilih foto dari galeri').setInputFiles(
    Array.from({ length: count }, (_, index) => ({
      name: `sudut-${index}.png`,
      mimeType: 'image/png',
      buffer,
    }))
  );
}

test('camera preview and retake never start AI before confirmation', async ({ page, backend }) => {
  await login(page);
  await page.getByRole('button', { name: 'Buka Kamera', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0);
  await page.getByRole('button', { name: 'Ambil Foto', exact: true }).click();
  await expect(page.getByAltText('Pratinjau foto 1')).toBeVisible();
  expect(backend.detectionCalls).toBe(0);
  expect(backend.writes).toEqual([]);
  await page.getByRole('button', { name: 'Ambil ulang foto 1' }).click();
  await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0);
  await page.getByRole('button', { name: 'Ambil Foto', exact: true }).click();
  await expect(page.getByText('1/5 foto dipilih')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tambah dari Kamera' })).toBeVisible();
  expect(backend.detectionCalls).toBe(0);
  await page.getByRole('button', { name: 'Analisis Foto', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kirim Laporan' })).toBeEnabled();
  expect(backend.detectionCalls).toBe(1);
});

test('gallery works with camera denied and saves all angles', async ({
  page,
  backend,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    };
  });
  await login(page);
  await page.getByRole('button', { name: 'Buka Kamera', exact: true }).click();
  await expect(page.getByText('Akses kamera ditolak.', { exact: false })).toBeVisible();
  await selectPhotos(page, 3);
  await expect(page.getByText('3/5 foto dipilih')).toBeVisible();
  await page.getByAltText('Pratinjau foto 1', { exact: true }).click();
  await expect(page.getByAltText('Pratinjau foto 1', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Tutup', exact: true }).click();
  expect(backend.detectionCalls).toBe(0);
  await page.getByRole('button', { name: 'Hapus foto 2' }).click();
  await expect(page.getByText('2/5 foto dipilih')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('multi-photo-preview-mobile.png'),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Analisis Foto', exact: true }).click();
  await expect(page.getByText('2 dari 2 foto menunjukkan dugaan kerusakan.')).toBeVisible();
  expect(backend.detectionCalls).toBe(2);
  await page.getByRole('button', { name: 'Kirim Laporan' }).click();
  await expect(page.getByRole('heading', { name: 'Laporan terkirim' })).toBeVisible();
  expect(backend.writes.filter((entry) => entry.type === 'report')).toHaveLength(1);
  expect(backend.writes.filter((entry) => entry.type === 'storage')).toHaveLength(2);
  expect(backend.photos).toHaveLength(1);
  expect(backend.writes.find((entry) => entry.type === 'report').data.note).toContain(
    'Bukti 2 foto'
  );
});

test('limits and corrupt files preserve the existing draft', async ({ page, backend }) => {
  await login(page);
  await selectPhotos(page, 1);
  await expect(page.getByText('1/5 foto dipilih')).toBeVisible();
  await selectPhotos(page, 5);
  await expect(page.getByRole('alert')).toContainText('Maksimal 5 foto');
  await expect(page.getByText('1/5 foto dipilih')).toBeVisible();
  await page.getByLabel('Pilih foto dari galeri').setInputFiles({
    name: 'rusak.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByRole('alert')).toContainText('Foto tidak bisa dibaca');
  await expect(page.getByAltText('Pratinjau foto 1')).toBeVisible();
  expect(backend.detectionCalls).toBe(0);
  expect(backend.writes).toEqual([]);
});

test('negative and failed analyses cannot submit and retain previews', async ({
  page,
  backend,
}) => {
  backend.detectionResults = [
    { imageWidth: 100, imageHeight: 100, detections: [] },
    { imageWidth: 100, imageHeight: 100, detections: [] },
    'error',
  ];
  await login(page);
  await selectPhotos(page, 2);
  await page.getByRole('button', { name: 'Analisis Foto', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Kerusakan Jalan Tidak Terdeteksi' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kirim Laporan' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Periksa Foto Lagi' }).click();
  await expect(page.getByText('2/5 foto dipilih')).toBeVisible();
  await page.getByRole('button', { name: 'Analisis Foto', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Analisis AI gagal');
  expect(backend.writes).toEqual([]);
  await page.getByRole('button', { name: 'Analisis Foto', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kirim Laporan' })).toBeEnabled();
});

test('mixed detections are explained and editing invalidates analysis', async ({
  page,
  backend,
}) => {
  backend.detectionResults = [{ imageWidth: 100, imageHeight: 100, detections: [] }];
  await login(page);
  await selectPhotos(page, 2);
  await page.getByRole('button', { name: 'Analisis Foto', exact: true }).click();
  await expect(page.getByText('1 dari 2 foto menunjukkan dugaan kerusakan.')).toBeVisible();
  await expect(page.getByText('Hasil antar foto berbeda.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Hapus foto 1' }).click();
  await expect(page.getByRole('button', { name: 'Kirim Laporan' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Analisis Foto', exact: true })).toBeEnabled();
  expect(backend.writes).toEqual([]);
});

test('retry after evidence linking fails reuses report and uploads', async ({ page, backend }) => {
  await login(page);
  await selectPhotos(page, 3);
  await page.getByRole('button', { name: 'Analisis Foto', exact: true }).click();
  backend.failPhotoInsert = true;
  await page.getByRole('button', { name: 'Kirim Laporan' }).click();
  await expect(page.getByRole('alert')).toContainText('Foto pendukung gagal disimpan');
  await expect(page.getByRole('button', { name: 'Hapus foto 1' })).toBeDisabled();
  backend.failPhotoInsert = false;
  await page.getByRole('button', { name: 'Kirim Laporan' }).click();
  await expect(page.getByRole('heading', { name: 'Laporan terkirim' })).toBeVisible();
  expect(backend.writes.filter((entry) => entry.type === 'report')).toHaveLength(1);
  expect(backend.writes.filter((entry) => entry.type === 'storage')).toHaveLength(3);
  expect(backend.photos).toHaveLength(2);
});

for (const action of ['support', 'dispute']) {
  test(`duplicate ${action} saves every angle and resumes failed uploads`, async ({
    page,
    backend,
  }) => {
    backend.reports = [
      {
        id: 'existing',
        status: 'open',
        damage_type: 'pothole',
        lat: -7.4478,
        lng: 112.7183,
        created_at: new Date().toISOString(),
      },
    ];
    await login(page);
    await selectPhotos(page, 2);
    await page.getByRole('button', { name: 'Analisis Foto', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Laporan serupa ditemukan' })).toBeVisible();
    backend.failPhotoInsert = true;
    const choice = page.getByRole('button', {
      name: action === 'support' ? 'Ya, kerusakan sama' : 'Tidak, kerusakan beda',
    });
    await choice.click();
    await expect(page.getByRole('alert')).toContainText('Foto pendukung gagal disimpan');
    backend.failPhotoInsert = false;
    await choice.click();
    await expect(
      page.getByRole('heading', {
        name: action === 'support' ? 'Laporan terkirim' : 'Menunggu Validasi Admin',
      })
    ).toBeVisible();
    expect(backend.writes.filter((entry) => entry.type === 'storage')).toHaveLength(2);
    expect(backend.photos).toHaveLength(action === 'support' ? 2 : 1);
    expect(
      backend.writes.filter(
        (entry) =>
          entry.type === (action === 'support' ? 'rpc/add_reporter' : 'rpc/create_disputed_report')
      )
    ).toHaveLength(1);
  });
}

for (const role of ['user', 'admin']) {
  test(`${role} can open and zoom supporting evidence`, async ({ page, backend }, testInfo) => {
    backend.role = role;
    const reportId = '00000000-0000-4000-8000-000000000002';
    backend.reports = [
      {
        id: reportId,
        user_id: '00000000-0000-4000-8000-000000000001',
        status: 'accepted',
        damage_type: 'pothole',
        severity: 'sedang',
        hazard_score: 59,
        created_at: '2026-09-25T06:00:00Z',
        image_path: `${reportId}/main.png`,
        lat: -7.4478,
        lng: 112.7183,
      },
    ];
    backend.photos = [1, 2].map((n) => ({
      id: `photo-${n}`,
      report_id: reportId,
      image_path: `${reportId}/support-${n}.png`,
      photo_type: 'support',
    }));
    await login(page);
    await page.goto(role === 'admin' ? '/admin/laporan' : '/riwayat');
    await page
      .getByRole('button', {
        name: role === 'admin' ? 'Lihat Semua Foto' : 'Lihat Detail',
        exact: true,
      })
      .click();
    await expect(page.getByAltText('Foto pendukung 1', { exact: true })).toBeVisible();
    await expect(page.getByAltText('Foto pendukung 2', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`evidence-${role}.png`), fullPage: true });
    await page.getByAltText('Foto pendukung 1', { exact: true }).click();
    await expect(page.getByAltText('Foto pendukung 1', { exact: true })).toHaveCount(2);
  });
}
