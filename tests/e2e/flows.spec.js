import { test, expect, login, capture } from './fixtures.js';

test('public routes, login guards, navigation and responsive layout', async ({ page, backend }) => {
  for (const route of ['/', '/dashboard', '/peta', '/lapor', '/riwayat', '/login']) {
    await page.goto(route);
    await expect(page.locator('body')).not.toHaveText('');
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  }
  for (const route of ['/admin', '/admin/laporan', '/admin/statistik', '/admin/pengguna', '/profil']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
  await page.goto('/');
  await expect(page.locator('.rw-header-desktop')).toBeVisible();
  await expect(page.locator('.rw-mobile-bottom-nav')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.rw-mobile-bottom-nav')).toBeVisible();
  await expect(page.locator('.rw-header-desktop')).toHaveCount(0);
  await page.getByRole('link', { name: 'Lapor', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Masuk Untuk Melapor' })).toBeVisible();
  expect(backend.writes).toEqual([]);
});

test('real mode captures camera, runs real YOLO, sends WebP in Sidoarjo', async ({ page, backend }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Buat Laporan Kerusakan Jalan' })).toBeVisible();
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await capture(page);
  await expect(page.getByRole('button', { name: 'Kirim Laporan' })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Kirim Laporan' }).click();
  await expect(page.getByRole('heading', { name: 'Laporan terkirim' })).toBeVisible();
  const report = backend.writes.find((r) => r.type === 'report').data;
  expect(report.location).toContain('112.7183 -7.4478');
  expect(report.note ?? '').not.toContain('UJI COBA');
  expect(report.hazard_score).toBeGreaterThanOrEqual(0);
  expect(report.hazard_score).toBeLessThanOrEqual(100);
  expect(backend.writes.filter((r) => r.type === 'storage')).toHaveLength(1);
});

test('outside Sidoarjo rejected in real mode; competition mode succeeds anywhere', async ({ page, context, backend }) => {
  await context.setGeolocation({ latitude: -6.2088, longitude: 106.8456 });
  await login(page);
  await capture(page);
  await expect(page.getByText('Laporan Real hanya untuk wilayah', { exact: false })).toBeVisible();
  expect(backend.writes).toEqual([]);
  const trial = page.getByRole('button', { name: 'Mode Uji Coba (Bebas Lokasi)', exact: true });
  await trial.click();
  await expect(page.getByText('Mode Uji Coba aktif', { exact: false })).toBeVisible();
  await capture(page);
  await expect(page.getByRole('button', { name: 'Kirim Laporan' })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Laporan Real (Khusus Sidoarjo)', exact: true }).click();
  await page.getByRole('button', { name: 'Kirim Laporan' }).click();
  expect(backend.writes).toEqual([]);
  await expect(page.getByText('Laporan Real hanya untuk wilayah', { exact: false })).toBeVisible();
  await trial.click();
  await page.getByRole('button', { name: 'Kirim Laporan' }).click();
  await expect(page.getByRole('heading', { name: 'Laporan terkirim' })).toBeVisible();
  const report = backend.writes.find((r) => r.type === 'report').data;
  expect(report.location).toContain('106.8456 -6.2088');
  expect(report.note).toContain('UJI COBA LOMBA');
});

test('camera unavailable is recoverable and never offers gallery upload', async ({ page, backend }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('No device', 'NotFoundError'); };
  });
  await login(page);
  await expect(page.getByText('Kamera tidak tersedia di perangkat ini.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Coba kamera lagi' })).toBeEnabled();
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mode Uji Coba (Bebas Lokasi)', exact: true }).click();
  await page.getByRole('button', { name: 'Coba kamera lagi' }).click();
  expect(backend.writes).toEqual([]);
});

test('GPS denied blocks submission in either mode with a clear recovery message', async ({ page, backend }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) => fail({ code: 1, message: 'Permission denied' });
  });
  await login(page);
  await page.getByRole('button', { name: 'Mode Uji Coba (Bebas Lokasi)', exact: true }).click();
  await capture(page);
  await expect(page.getByRole('button', { name: 'Kirim Laporan' })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Kirim Laporan' }).click();
  await expect(page.getByText('Lokasi belum terdeteksi. Izinkan GPS', { exact: false })).toBeVisible();
  expect(backend.writes).toEqual([]);
});

test('failed photo upload can be retried without creating another report', async ({ page, backend }) => {
  backend.failUpload = true;
  await login(page);
  await capture(page);
  await expect(page.getByRole('button', { name: 'Kirim Laporan' })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Kirim Laporan' }).click();
  await expect(page.getByText('Simulated storage failure')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Laporan terkirim' })).toHaveCount(0);
  backend.failUpload = false;
  await page.getByRole('button', { name: 'Kirim Laporan' }).click();
  await expect(page.getByRole('heading', { name: 'Laporan terkirim' })).toBeVisible();
  expect(backend.writes.filter((r) => r.type === 'report')).toHaveLength(1);
});

test('admin login waits for profile and all admin pages render', async ({ page, backend }) => {
  backend.role = 'admin';
  backend.profileDelay = 300;
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  for (const route of ['/admin', '/admin/laporan', '/admin/pengguna', '/admin/statistik', '/admin/profil']) {
    await page.goto(route);
    await expect(page.locator('main')).not.toHaveText('');
    await expect(page).toHaveURL(new RegExp(`${route}$`));
  }
});

test('profile read failure shows retry instead of an empty redirect page', async ({ page, backend }) => {
  backend.failProfile = true;
  await login(page);
  await expect(page.getByRole('button', { name: 'Muat ulang profil' })).toBeVisible();
  backend.failProfile = false;
  await page.getByRole('button', { name: 'Muat ulang profil' }).click();
  await expect(page.getByRole('heading', { name: 'Buat Laporan Kerusakan Jalan' })).toBeVisible();
});

test('registration requiring confirmation shows instructions', async ({ page, backend }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Daftar di sini' }).click();
  await page.getByLabel('Username', { exact: true }).fill('Juri');
  await page.getByLabel('Email', { exact: true }).fill('judge@example.test');
  await page.getByLabel('Password', { exact: true }).fill('local-password');
  await page.getByRole('button', { name: 'Daftar Sekarang' }).click();
  await expect(page.getByText('Pendaftaran diterima.', { exact: false })).toBeVisible();
  expect(backend.writes).toEqual([]);
});

test('mobile competition mode fits viewport and camera permission can be retried', async ({ page, backend }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.cameraDeniedForTest = true;
    navigator.mediaDevices.getUserMedia = (options) => window.cameraDeniedForTest
      ? Promise.reject(new DOMException('Denied', 'NotAllowedError')) : original(options);
  });
  await login(page);
  await expect(page.getByText('Akses kamera ditolak.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Mode Uji Coba (Bebas Lokasi)', exact: true }).click();
  await page.evaluate(() => { window.cameraDeniedForTest = false; });
  await page.getByRole('button', { name: 'Coba kamera lagi' }).click();
  await expect(page.getByRole('button', { name: '📸 Ambil Foto', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('competition-mobile.png'), fullPage: true });
  await capture(page);
  await expect(page.getByRole('button', { name: 'Kirim Laporan' })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Kirim Laporan' }).click();
  await expect(page.getByRole('heading', { name: 'Laporan terkirim' })).toBeVisible();
  expect(backend.writes.filter(r => r.type === 'report')).toHaveLength(1);
});

for (const role of ['user', 'admin']) {
  test(`${role} profile save keeps form mounted and confirms persistence`, async ({ page, backend }) => {
    backend.role = role;
    await login(page);
    await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/lapor$/);
    await page.goto(role === 'admin' ? '/admin/profil' : '/profil');
    await expect(page.getByLabel('Username', { exact: true })).toHaveValue('Juri');
    await page.getByLabel('Username', { exact: true }).fill('Juri Lokal');
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await expect(page.getByText('Profil berhasil disimpan.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Username', { exact: true })).toHaveValue('Juri Lokal');
    expect(backend.writes.filter(r => r.type === 'profile')).toHaveLength(1);
  });
}
