import { configured, getStats, json } from './_lib.js';

export default {
  async fetch(request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
    if (!configured()) return json({ mode: 'preview', completed: null, averageChange: null });
    try {
      return json({ mode: 'live', ...(await getStats()) });
    } catch {
      return json({ error: 'Live activity is temporarily unavailable.' }, 503);
    }
  }
};
