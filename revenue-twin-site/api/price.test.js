import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './price.js';

const saved = Object.fromEntries(['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'RATE_LIMIT_SALT'].map(k => [k, process.env[k]]));
const originalFetch = globalThis.fetch;

function restore() {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(saved)) value == null ? delete process.env[key] : process.env[key] = value;
}

test('an unconfigured deployment does not pretend to call Gemini', async () => {
  for (const key of Object.keys(saved)) delete process.env[key];
  const response = await handler.fetch(new Request('https://example.test/api/price', { method: 'POST', body: '{}' }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not configured/i);
  restore();
});

test('a normal request stores a structured result and returns Supabase read-back', async () => {
  Object.assign(process.env, { GEMINI_API_KEY: 'test-key', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_KEY: 'test-secret', RATE_LIMIT_SALT: 'test-salt' });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/rpc/reserve_revenue_twin_request')) return Response.json('00000000-0000-4000-8000-000000000001');
    if (String(url).includes('generativelanguage.googleapis.com')) return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ headline: 'Test this rate', reason: 'The supplied median is higher.', uncertainty: 'Demand is your estimate.', nextStep: 'Check two real comparables.' }) }] } }],
      usageMetadata: { promptTokenCount: 101, candidatesTokenCount: 50 }
    });
    if (String(url).includes('/revenue_twin_requests?')) return new Response(null, { status: 204 });
    if (String(url).endsWith('/rpc/revenue_twin_stats')) return Response.json({ completed: 1, averageChange: 45 });
    throw new Error('Unexpected call');
  };
  try {
    const response = await handler.fetch(new Request('https://example.test/api/price', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentRate: 185, comparableMedian: 225, demand: 'busy', eventNote: 'festival' })
    }));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.suggestedRate, 230);
    assert.equal(data.stats.completed, 1);
    assert.equal(calls.length, 4);
    assert.match(calls[2].options.body, /"input_tokens":101/);
    assert.ok(!calls[0].options.headers.Authorization, 'new Supabase secret key must not be sent as a bearer token');
  } finally { restore(); }
});

test('a fourth request is capped before Gemini is called', async () => {
  Object.assign(process.env, { GEMINI_API_KEY: 'test-key', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_KEY: 'test-secret', RATE_LIMIT_SALT: 'test-salt' });
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json(null); };
  try {
    const response = await handler.fetch(new Request('https://example.test/api/price', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentRate: 185, comparableMedian: 225, demand: 'busy' })
    }));
    assert.equal(response.status, 429);
    assert.equal(calls, 1);
  } finally { restore(); }
});
