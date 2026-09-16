import { test as base, expect } from '@playwright/test';

const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', email: 'judge@example.test', user_metadata: { username: 'Juri' } };
const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 86400, role: 'authenticated' })).toString('base64url');
const session = { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.local-signature`, refresh_token: 'local-refresh', token_type: 'bearer', expires_in: 86400, user };

export const test = base.extend({
  backend: async ({ page }, runFixture) => {
    const state = { role: 'user', username: 'Juri', writes: [], reports: [], failUpload: false, failProfile: false, profileDelay: 0, pageErrors: [], unhandled: [] };
    page.on('pageerror', (error) => state.pageErrors.push(error.message));
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.hostname === '127.0.0.1' && ['5175', '4175'].includes(url.port)) return route.continue();
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.origin === 'http://127.0.0.1:54321') {
        if (url.pathname === '/auth/v1/token') return json(session);
        if (url.pathname === '/auth/v1/user') return json(user);
        if (url.pathname === '/auth/v1/signup') return json({ user, session: null });
        if (url.pathname === '/auth/v1/logout') return json({});
        if (url.pathname.startsWith('/storage/v1/object/')) {
          state.writes.push({ type: 'storage', method: request.method(), bytes: request.postDataBuffer()?.length });
          return state.failUpload ? json({ message: 'Simulated storage failure', error: 'StorageFailure', statusCode: 500 }, 500) : json({ Key: url.pathname });
        }
        const table = url.pathname.split('/rest/v1/')[1];
        if (table === 'profiles') {
          if (request.method() === 'PATCH') {
            const patch = request.postDataJSON();
            state.writes.push({ type: 'profile', data: patch });
            if (patch.username) state.username = patch.username;
          }
          if (state.profileDelay) await new Promise((resolve) => setTimeout(resolve, state.profileDelay));
          if (state.failProfile) return json({ message: 'Profile temporarily unavailable' }, 503);
          const profile = { ...user, username: state.username, role: state.role, avatar_url: null };
          return json(request.headers().accept?.includes('object') ? profile : [profile]);
        }
        if (table === 'reports' && request.method() === 'POST') {
          const data = request.postDataJSON();
          state.writes.push({ type: 'report', data });
          return json({ ...data, id: '00000000-0000-4000-8000-000000000002', status: 'open', created_at: new Date().toISOString() }, 201);
        }
        if (table === 'reports' && request.method() === 'PATCH') {
          state.writes.push({ type: 'report-update', data: request.postDataJSON() });
          return json({ id: '00000000-0000-4000-8000-000000000002', ...request.postDataJSON() });
        }
        if (table === 'reports_with_coords' || table === 'reports') return json(state.reports);
        if (['report_supports', 'report_photos', 'comments'].includes(table)) return json([]);
        if (table?.startsWith('rpc/')) { state.writes.push({ type: table }); return json(null); }
        state.unhandled.push(`${request.method()} ${url.pathname}`);
        return json({ message: 'Unimplemented local test endpoint' }, 501);
      }
      // Local-only suite: external APIs/assets are fulfilled here, never contacted.
      if (url.hostname === 'nominatim.openstreetmap.org') return json({ address: { road: 'Jalan Uji Lokal', city: 'Lokasi Simulasi' } });
      if (url.pathname.endsWith('.png')) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQ0AAAAASUVORK5CYII=', 'base64') });
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    });
    await runFixture(state);
    expect(state.pageErrors).toEqual([]);
    expect(state.unhandled).toEqual([]);
  }
});
export { expect };

export async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('judge@example.test');
  await page.getByLabel('Password', { exact: true }).fill('local-password');
  await page.getByRole('button', { name: 'Masuk Sekarang', exact: true }).click();
}

export async function capture(page) {
  const button = page.getByRole('button', { name: '📸 Ambil Foto', exact: true });
  await expect(button).toBeEnabled();
  await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0);
  await button.click();
}
