import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures.js';

for (const script of ['admin-data.browser.js', 'image-upload.browser.js', 'ai-audit.browser.js']) {
  test(script, async ({ page, backend }) => {
    await page.goto('/');
    const source = await readFile(new URL(`../${script}`, import.meta.url), 'utf8');
    const result = await page.evaluate(source);
    expect(result.passed).toBe(true);
    expect(backend.writes).toEqual([]);
  });
}

test('location boundaries and conservative duplicate fallback', async ({ page, backend }) => {
  backend.reports = [
    {
      id: 'near',
      lat: -7.4478,
      lng: 112.7184,
      damage_type: 'pothole',
      created_at: new Date().toISOString(),
    },
    {
      id: 'far',
      lat: -7.45,
      lng: 112.72,
      damage_type: 'pothole',
      created_at: new Date().toISOString(),
    },
    { id: 'invalid', lat: null, lng: null, damage_type: 'pothole' },
  ];
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { validateReportLocation } = await import('/src/lib/reportLocation.js');
    const { findSimilarReports, listOpenReports } = await import('/src/lib/reports.js');
    const { pickBestDuplicate } = await import('/src/ai/duplicateScore.js');
    const sidoarjo = { lat: -7.4478, lng: 112.7183 };
    const jakarta = { lat: -6.2088, lng: 106.8456 };
    const candidates = await findSimilarReports({
      ...sidoarjo,
      damageType: 'pothole',
      embedding: null,
    });
    return {
      realAllowed: validateReportLocation(sidoarjo),
      realRejected: !!validateReportLocation(jakarta),
      trialAllowed: validateReportLocation(jakarta, true),
      invalid: [
        null,
        { lat: NaN, lng: 112 },
        { lat: 91, lng: 0 },
        { lat: 0, lng: 181 },
        { lat: 0, lng: Infinity },
      ].every((p) => !!validateReportLocation(p, true)),
      candidates,
      best: pickBestDuplicate(candidates),
      map: await listOpenReports(),
    };
  });
  expect(result.realAllowed).toBeNull();
  expect(result.realRejected).toBe(true);
  expect(result.trialAllowed).toBeNull();
  expect(result.invalid).toBe(true);
  expect(result.candidates.map((c) => c.id)).toEqual(['near']);
  expect(result.best.action).toBe('ask_user');
  expect(result.best.probability).toBeNull();
  expect(result.map[0].lat).toBe(-7.4478);
});
