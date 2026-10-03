import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './demand.js';

const keys = ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'RATE_LIMIT_SALT'];
const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

function restore() {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(saved)) value == null ? delete process.env[key] : process.env[key] = value;
}

test('demand analysis rejects malformed signals before external calls', async () => {
  Object.assign(process.env, { GEMINI_API_KEY: 'test-key', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_KEY: 'test-secret', RATE_LIMIT_SALT: 'test-salt' });
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected external call'); };
  try {
    const response = await handler.fetch(new Request('https://example.test/api/demand', { method: 'POST', body: JSON.stringify({ search: 120, booking: 40, availability: 50, event: 0 }) }));
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally { restore(); }
});

test('Gemini interpretation of illustrative signals is saved and read back', async () => {
  Object.assign(process.env, { GEMINI_API_KEY: 'test-key', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_KEY: 'test-secret', RATE_LIMIT_SALT: 'test-salt' });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/rpc/reserve_revenue_twin_request')) return Response.json('00000000-0000-4000-8000-000000000001');
    if (String(url).includes('generativelanguage.googleapis.com')) return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ insight: 'The scenario suggests moderate demand pressure.', drivers: 'Search interest and booking pace contribute most.', uncertainty: 'The inputs are hypothetical and not a trained forecast.', nextStep: 'Connect authorized booking history before pricing.' }) }] } }],
      usageMetadata: { promptTokenCount: 91, candidatesTokenCount: 47 }
    });
    if (String(url).includes('/revenue_twin_requests?')) return new Response(null, { status: 204 });
    if (String(url).endsWith('/rpc/revenue_twin_stats')) return Response.json({ completed: 4, averageChange: 45 });
    throw new Error('Unexpected call');
  };
  try {
    const response = await handler.fetch(new Request('https://example.test/api/demand', { method: 'POST', body: JSON.stringify({ search: 65, booking: 75, availability: 40, event: 15 }) }));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.score, 63);
    assert.equal(data.level, 'moderate');
    assert.equal(data.stats.completed, 4);
    assert.equal(calls.length, 4);
    assert.match(calls[2].options.body, /"input_tokens":91/);
    assert.match(calls[2].options.body, /"kind":"demand_scenario"/);
  } finally { restore(); }
});

test('shared daily cap stops a demand request before Gemini', async () => {
  Object.assign(process.env, { GEMINI_API_KEY: 'test-key', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_KEY: 'test-secret', RATE_LIMIT_SALT: 'test-salt' });
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json(null); };
  try {
    const response = await handler.fetch(new Request('https://example.test/api/demand', { method: 'POST', body: JSON.stringify({ search: 65, booking: 75, availability: 40, event: 15 }) }));
    assert.equal(response.status, 429);
    assert.equal(calls, 1);
  } finally { restore(); }
});
