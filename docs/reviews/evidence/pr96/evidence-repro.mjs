// Review-only probe: asserts the defects present at 5f024a1, not desired behavior.
import assert from 'node:assert/strict';
import { acceptEvidence, revalidateAcceptedEvidence } from '../../../../lib/engine/evidence/accept.ts';
import { renderEvidenceInline } from '../../../../lib/engine/evidence/tokens.ts';

const retrievedAt = '2026-10-03T00:00:00.000Z';
function probe(name, text, candidate, expectedAccepted) {
  const isStat = 'metric' in candidate;
  const url = candidate.sourceUrl;
  const roles = ['market', 'competitors'];
  const candidates = { quotes: [], marketStats: isStat ? [candidate] : [], competitorPrices: isStat ? [] : [candidate] };
  const result = acceptEvidence({
    candidates,
    citations: [{ url, title: 'Source' }],
    sources: new Map([[url, { status: 'read', text, retrievedAt, roles }]]),
  });
  assert.equal(result.accepted.length, expectedAccepted ? 1 : 0, name);
  const revalidated = result.accepted.map(item => revalidateAcceptedEvidence(item, [{ url, status: 'read', retrievedAt, roles }]));
  for (const item of revalidated) assert.equal(item.ok, true, `${name}: stored record also accepts`);
  console.log(JSON.stringify({name, source: text, candidate, accepted:result.accepted, rejected:result.rejected, revalidation:revalidated.map(r=>r.ok), rendered:result.accepted.map(renderEvidenceInline)}, null, 2));
}
const statSource = 'The AI code review market was worth $1.4 million in 2024, while the unrelated gaming market was worth $9.4 billion in 2025.';
probe('CROSS-SUBJECT: gaming value credited to AI code review', statSource, {
  sourceUrl:'https://research.example/report', supportingText:statSource,
  subject:'AI code review market', metric:'market_size', amountText:'$9.4 billion', periodKind:'measured', year:2025,
}, true);
const negative = 'CodeRabbit does not cost $30/user/month.';
probe('NEGATION: denial becomes affirmative current price', negative, {
  sourceUrl:'https://coderabbit.ai/pricing', supportingText:negative, vendor:'CodeRabbit', priceText:'$30/user/month',
}, true);
const former = 'CodeRabbit used to cost $30/user/month.';
probe('FORMER: old price becomes current price', former, {
  sourceUrl:'https://coderabbit.ai/pricing', supportingText:former, vendor:'CodeRabbit', priceText:'$30/user/month',
}, true);
const billing = 'CodeRabbit costs $30 per developer per month, or $24 per developer per month when billed annually.';
for (const [name, priceText, accepted] of [
  ['BILLING: incorrect annual qualifier accepted','$30/user/month, billed annually',true],
  ['BILLING: correct monthly price rejected','$30/user/month',false],
]) probe(name,billing,{sourceUrl:'https://coderabbit.ai/faq',supportingText:billing,vendor:'CodeRabbit',priceText},accepted);
const hedge = 'Macroscope costs approximately $152/month at the historical average.';
probe('HEDGE: estimate becomes exact list price',hedge,{
 sourceUrl:'https://macroscope.com/pricing',supportingText:hedge,vendor:'Macroscope',priceText:'$152/month',
},true);
