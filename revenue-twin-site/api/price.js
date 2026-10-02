import { configured, getStats, json, suggestRate, supabase, SYSTEM_PROMPT, validateInput, visitorKey } from './_lib.js';

function safeAnswer(raw) {
  const parsed = JSON.parse(raw);
  const fields = ['headline', 'reason', 'uncertainty', 'nextStep'];
  if (fields.some(k => typeof parsed[k] !== 'string' || !parsed[k].trim() || parsed[k].length > 450)) {
    throw new Error('Incomplete AI response.');
  }
  return Object.fromEntries(fields.map(k => [k, parsed[k].trim()]));
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    if (!configured()) return json({ error: 'The live analysis is not configured yet. This page is a preview.' }, 503);
    let input;
    try {
      if (Number(request.headers.get('content-length') || 0) > 2000) return json({ error: 'Input is too long.' }, 413);
      input = validateInput(await request.json());
    } catch (error) {
      return json({ error: error.message || 'Please check the fields.' }, 400);
    }

    const suggestedRate = suggestRate(input);
    const key = visitorKey(request, process.env.RATE_LIMIT_SALT);
    let rowId;
    try {
      rowId = await supabase('rpc/reserve_revenue_twin_request', {
        method: 'POST',
        body: JSON.stringify({ p_visitor_key: key, p_input: { ...input, suggestedRate } })
      });
      if (!rowId) return json({ error: 'You have used the three free analyses available in 24 hours.' }, 429);

      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let aiResponse;
      try {
        aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: JSON.stringify({ ...input, suggestedRate }) }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 350,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  headline: { type: 'STRING' }, reason: { type: 'STRING' },
                  uncertainty: { type: 'STRING' }, nextStep: { type: 'STRING' }
                },
                required: ['headline', 'reason', 'uncertainty', 'nextStep']
              }
            }
          })
        });
      } finally { clearTimeout(timeout); }
      if (!aiResponse.ok) throw new Error(`AI request failed (${aiResponse.status}).`);
      const result = await aiResponse.json();
      const text = result.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      const answer = safeAnswer(text);
      const usage = result.usageMetadata || {};
      await supabase(`revenue_twin_requests?id=eq.${rowId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'complete', output: { suggestedRate, ...answer },
          input_tokens: usage.promptTokenCount ?? null,
          output_tokens: usage.candidatesTokenCount ?? null
        })
      });
      let stats = null;
      try { stats = await getStats(); } catch { /* analysis still succeeded */ }
      return json({ suggestedRate, answer, stats });
    } catch {
      if (rowId) {
        try {
          await supabase(`revenue_twin_requests?id=eq.${rowId}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'failed' })
          });
        } catch { /* preserve original error */ }
      }
      return json({ error: 'The analysis could not be completed. Please try again later.' }, 503);
    }
  }
};
