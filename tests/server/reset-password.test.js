import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResetPasswordHandler } from '../../server/reset-password.js';

const enabled = { ALLOW_EMAIL_ONLY_PASSWORD_RESET: 'true', SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-secret' };
const body = { email: ' Person@Example.test ', password: 'new-password', confirmation: 'new-password' };
async function call({ env = enabled, method = 'POST', input = body, found = true, failUpdate = false, failLookup = false } = {}) {
  const calls = [];
  const handler = createResetPasswordHandler({ env, createAdmin: () => ({
    generateLink: async args => {
      calls.push(['lookup', args]);
      if (failLookup) throw new Error('private upstream details');
      return found ? { data: { user: { id: 'user-1', email: 'person@example.test' }, properties: { action_link: 'secret-recovery-link' } } } : { error: { code: 'user_not_found' } };
    },
    updateUserById: async (...args) => { calls.push(['update', ...args]); return { error: failUpdate ? new Error('private details') : null }; }
  }) });
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } };
  await handler({ method, body: input }, res);
  return { res, calls };
}

test('disabled or unconfigured endpoint never calls Auth Admin', async () => {
  for (const env of [{}, { ...enabled, ALLOW_EMAIL_ONLY_PASSWORD_RESET: 'false' }, { ...enabled, SUPABASE_SERVICE_ROLE_KEY: '' }]) {
    const { res, calls } = await call({ env });
    assert.equal(res.code, 503); assert.deepEqual(calls, []);
  }
});
test('only accepts POST and validates the full request before lookup', async () => {
  assert.equal((await call({ method: 'GET' })).res.code, 405);
  for (const input of ['{', null, {}, { ...body, email: 'invalid' }, { ...body, password: 'short' }, { ...body, confirmation: 'different' }, { ...body, password: 'x'.repeat(129) }]) {
    const { res, calls } = await call({ input });
    assert.equal(res.code, 400); assert.deepEqual(calls, []);
  }
});
test('matches normalized existing email and updates only that user without exposing tokens', async () => {
  const { res, calls } = await call();
  assert.equal(res.code, 200);
  assert.deepEqual(res.data, { success: true });
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.deepEqual(calls, [['lookup', { type: 'recovery', email: 'person@example.test' }], ['update', 'user-1', { password: 'new-password' }]]);
});
test('unknown email never updates a password', async () => {
  const { res, calls } = await call({ found: false });
  assert.equal(res.code, 404); assert.equal(calls.length, 1);
});
test('upstream failures do not report success or leak internal details', async () => {
  for (const options of [{ failLookup: true }, { failUpdate: true }]) {
    const { res } = await call(options);
    assert.ok(res.code >= 400); assert.equal(res.data.success, undefined);
    assert.ok(!JSON.stringify(res.data).includes('private'));
  }
});
