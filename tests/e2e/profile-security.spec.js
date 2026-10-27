import { test, expect, login } from './fixtures.js';
const targetId = '00000000-0000-4000-8000-000000000003';
test('admin role editor uses RPC, disables self edits and preserves state after server rejection', async ({
  page,
  backend,
}) => {
  backend.role = 'admin';
  backend.additionalProfiles = [
    { id: targetId, username: 'Warga Uji', role: 'user', avatar_url: null },
  ];
  await login(page);
  await page.goto('/admin/pengguna');
  const self = page.getByRole('row').filter({ hasText: 'Ini akun kamu' });
  await expect(self.getByRole('combobox')).toBeDisabled();
  const row = page.getByRole('row').filter({ hasText: 'Warga Uji' });
  await row.getByRole('combobox').selectOption('admin');
  await expect(row.getByRole('combobox')).toHaveValue('admin');
  expect(backend.writes.find((w) => w.type === 'role-rpc').data).toEqual({
    p_user_id: targetId,
    p_role: 'admin',
  });
  expect(backend.writes.filter((w) => w.type === 'profile')).toHaveLength(0);
  backend.roleChangeFailure = true;
  const alert = page.waitForEvent('dialog');
  await row.getByRole('combobox').selectOption('user');
  const dialog = await alert;
  expect(dialog.message()).toContain('Role change rejected by server');
  await dialog.accept();
  await expect(row.getByRole('combobox')).toHaveValue('admin');
});
for (const role of ['user', 'admin']) {
  test(`${role} notifications still render and mark read without direct helper RPC`, async ({
    page,
    backend,
  }) => {
    backend.role = role;
    backend.notifications = [
      {
        id: 'test-notification',
        title: 'Pembaruan laporan uji',
        body: 'Data fixture',
        created_at: '2026-10-27T00:00:00Z',
        read_at: null,
        type: 'status_changed',
      },
    ];
    await login(page);
    await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/lapor$/);
    await expect(
      page.getByRole('heading', {
        name: role === 'admin' ? 'Dashboard Admin' : 'Buat Laporan Kerusakan Jalan',
        exact: true,
      })
    ).toBeVisible();
    await page.getByRole('button', { name: /Juri/ }).click();
    await page.getByRole('button', { name: /Notifikasi/ }).click();
    await expect(page.getByText('Pembaruan laporan uji')).toBeVisible();
    await page.getByRole('button', { name: 'Tandai dibaca' }).click();
    await expect
      .poll(() => backend.writes.filter((w) => w.type === 'notification-read').length)
      .toBe(1);
    expect(backend.writes.some((w) => w.type.includes('notify_admins'))).toBe(false);
  });
}
