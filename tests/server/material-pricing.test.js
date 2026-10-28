import test from 'node:test';
import assert from 'node:assert/strict';
import {
  suggestEstimate,
  measureWork,
  applyCoefficients,
  validItems,
} from '../../src/ai/materialEstimate.js';
import {
  convertPrice,
  validateReference,
  compareMaterial,
  evaluateCosts,
  materialComposition,
} from '../../src/lib/materialPricing.js';
const reference = {
  material_name: 'Aspal hotmix',
  specification: 'AC-WC',
  unit: 'ton',
  reference_price: 2000000,
  reference_code: 'TEST-ONLY',
  source_name: 'Fixture; bukan data production',
  source_url: 'https://rds.sidoarjokab.go.id/',
  effective_year: 2026,
  verified_at: '2026-01-01T00:00:00Z',
  price_type: 'SSH',
  tax_inclusion: 'excluded',
  verification_status: 'verified',
};
const item = {
  name: 'Aspal hotmix',
  specification: 'AC-WC',
  unit: 'kg',
  unitPrice: 1800,
  quantity: 10,
  category: 'material',
  tax_inclusion: 'excluded',
};
const pair = (id, e, a) => ({
  id,
  status: 'resolved',
  estimated_cost: e,
  actual_cost: a,
  estimate_recorded_at: '2026-01-01',
  resolved_at: '2026-01-02',
  actual_cost_verified: true,
  actual_cost_evidence: 'NOTA-TEST',
});
test('all YOLO classes suggest distinct repair methods without invented quantities/prices', () => {
  const expected = {
    pothole: 'patch',
    alligator_crack: 'structural',
    longitudinal_crack: 'longitudinal',
    transverse_crack: 'transverse',
  };
  for (const [damage, method] of Object.entries(expected)) {
    const result = suggestEstimate(damage);
    assert.equal(result.method, method);
    assert.ok(result.items.every((i) => i.quantity === '' && i.unitPrice === ''));
    if (damage.endsWith('_crack') && damage !== 'alligator_crack')
      assert.deepEqual(
        result.items.map((i) => i.name),
        ['Sealant aspal']
      );
  }
  assert.deepEqual(suggestEstimate('unknown').items, []);
});
test('measured quantities use physical dimensions and documented coefficients', () => {
  assert.equal(
    measureWork({ basis: 'm3', length: 2, width: 3, depth: 0.05 }),
    0.3 + 0.00000000000000004
  );
  assert.equal(measureWork({ basis: 'm2', area: 4, length: 2, width: 3 }), 4);
  assert.equal(measureWork({ basis: 'm', length: 4 }), 4);
  assert.throws(() => measureWork({ basis: 'm3', area: 2, depth: 0 }));
  assert.throws(() => measureWork({ basis: 'm2', areaPct: 12 }));
  const m = {
    basis: 'm2',
    area: 2,
    source_url: 'https://binakonstruksi.pu.go.id/example',
    reference_code: 'fixture',
  };
  assert.equal(applyCoefficients([{ ...item, coefficient: 1.5 }], m)[0].quantity, 3);
  assert.throws(() => applyCoefficients([item], m));
  assert.throws(() =>
    applyCoefficients([{ ...item, coefficient: 2 }], { ...m, source_url: 'https://example.com' })
  );
});
test('unit conversion never invents material density or sack mass', () => {
  assert.equal(convertPrice(2000000, 'ton', 'kg'), 2000);
  assert.equal(convertPrice(2000, 'kg', 'ton'), 2000000);
  assert.equal(convertPrice(10000, 'liter', 'm3'), 10000000);
  assert.equal(convertPrice(100, 'kg', 'm3'), null);
  assert.equal(convertPrice(100, 'sak', 'kg'), null);
  assert.equal(convertPrice(100, 'buah', 'buah'), 100);
  assert.equal(convertPrice(100, 'buah', 'batang'), null);
  assert.equal(convertPrice(NaN, 'kg', 'kg'), null);
});
test('official catalog validates origin, metadata, positive price and verification', () => {
  assert.deepEqual(validateReference(reference), []);
  for (const patch of [
    { reference_price: 0 },
    { reference_price: Infinity },
    { reference_price: 1e15 },
    { source_url: 'https://sidoarjokab.go.id.evil.test' },
    { source_url: 'javascript:alert(1)' },
    { specification: '' },
    { reference_code: '' },
    { effective_year: 2026.5 },
    { verified_at: null },
    { unit: 'kg/m3' },
    { unit: 'invalid' },
    { source_url: 'http://sidoarjokab.go.id' },
    { material_name: 'x'.repeat(201) },
  ])
    assert.ok(validateReference({ ...reference, ...patch }).length);
});
test('price comparison requires matching specs, tax, year and material-only SSH', () => {
  const result = compareMaterial(item, reference, 2026);
  assert.equal(result.referencePrice, 2000);
  assert.equal(result.deviation, 10);
  assert.equal(result.score, 90);
  for (const patch of [
    { specification: 'AC-BC' },
    { tax_inclusion: 'included' },
    { price_type: 'HSPK' },
    { verification_status: 'draft' },
    { effective_year: 2025 },
  ])
    assert.equal(compareMaterial(item, { ...reference, ...patch }, 2026), null);
  assert.equal(compareMaterial({ ...item, category: 'labor' }, reference, 2026), null);
  assert.equal(compareMaterial({ ...item, unitPrice: 7000 }, reference, 2026).score, 0);
  assert.equal(
    compareMaterial(
      { ...item, unitPrice: 2000, price_origin: 'reference', reference_code: 'TEST-ONLY' },
      reference,
      2026
    ).sameSource,
    true
  );
});
test('WAPE/MAE use independent report pairs without netting opposite errors', () => {
  const reports = [
    pair('a', 80, 100),
    pair('b', 120, 100),
    { ...pair('c', 500, 100), estimate_recorded_at: null },
    { ...pair('d', 500, 100), actual_cost_verified: false },
    { ...pair('e', 20, 20), estimate_recorded_at: '2026-01-03' },
    pair('a', 80, 100),
    { ...pair('f', 30, 40), status: 'in_progress' },
  ];
  const result = evaluateCosts(reports);
  assert.equal(result.n, 2);
  assert.equal(result.wape, 20);
  assert.equal(result.mae, 20);
  assert.equal(result.score, 80);
  assert.equal(result.estimated, 200);
  assert.equal(result.actual, 200);
  assert.equal(evaluateCosts([]).wape, null);
  assert.equal(evaluateCosts([pair('z', 10, 0)]).wape, null);
  assert.equal(evaluateCosts([pair('z', 10, 0)]).mae, 10);
});
test('material donut excludes labor, equipment and unclassified legacy lines; uses computed subtotals', () => {
  const rows = materialComposition([
    {
      estimated_materials_json: [
        { ...item, lineTotal: 999999 },
        { ...item, category: 'labor' },
        { ...item, category: 'equipment' },
        { ...item, category: undefined },
      ],
    },
  ]);
  assert.deepEqual(rows, [{ name: 'Hotmix', value: 18000 }]);
  assert.ok(validItems([item]));
  assert.equal(validItems([{ ...item, unitPrice: -1 }]), false);
  assert.equal(validItems([{ ...item, quantity: '' }]), false);
});
