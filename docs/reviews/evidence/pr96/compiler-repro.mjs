// Review-only probe: asserts the defect present at 5f024a1, not desired behavior.
import assert from 'node:assert/strict';
import { buildFixtureRecord } from '../../../../lib/engine/__fixtures__/recordV2.ts';
import { auditPage, compiledPage, cleanupTempDirs } from '../../../../lib/engine/__fixtures__/auditHarness.ts';

try {
  const baseline = buildFixtureRecord();
  assert.equal((await auditPage(compiledPage(baseline), baseline)).ok, true);
  for (const qualifier of ['(billed annually)', '(billed monthly)', ', billed annually']) {
    const record = buildFixtureRecord(r => {
      r.editorial.pricingTiers.find(t => t.name === 'Crew').price = `$20/developer/month ${qualifier}`;
    });
    const page = compiledPage(record);
    const audit = await auditPage(page, record);
    const expectedPass = qualifier.startsWith(',');
    assert.equal(audit.ok, expectedPass);
    if (!expectedPass) assert.ok(audit.errors.some(e => e.includes('missing its computed ARR line')));
    console.log(JSON.stringify({ qualifier, line: page.split('\n').find(l => l.includes('Crew accounts paying')), ok: audit.ok, errors: audit.errors }, null, 2));
  }
} finally {
  cleanupTempDirs();
}
