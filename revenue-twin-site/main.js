const form = document.querySelector('#rate-form');
const result = document.querySelector('#result');
const submit = document.querySelector('#submit-button');
const status = document.querySelector('#tool-status');
const count = document.querySelector('#activity-count');
const detail = document.querySelector('#activity-detail');
let liveAvailable = false;

function el(tag, text, className) {
  const item = document.createElement(tag);
  if (text != null) item.textContent = text;
  if (className) item.className = className;
  return item;
}

function showError(message) {
  result.hidden = false;
  result.className = 'result error';
  result.replaceChildren(el('p', message));
}

function showResult(data) {
  result.hidden = false;
  result.className = 'result';
  result.replaceChildren(
    el('div', `$${data.suggestedRate}`, 'result-rate'),
    el('h3', data.answer.headline),
    el('p', data.answer.reason),
    el('p', `What could change this: ${data.answer.uncertainty}`),
    el('p', `Your next step: ${data.answer.nextStep}`),
    el('small', 'Estimate only. No listing price has been changed.')
  );
  updateStats(data.stats);
}

function showPreview(values) {
  const current = Number(values.currentRate);
  const median = Number(values.comparableMedian);
  if (!Number.isFinite(current) || current < 30 || current > 5000 || !Number.isFinite(median) || median < 30 || median > 5000) {
    return showError('Enter rates between $30 and $5,000.');
  }
  const factor = { quiet: .9, normal: 1, busy: 1.08 }[values.demand];
  const low = Math.max(30, current * .8);
  const high = Math.min(5000, current * 1.25);
  const suggested = Math.max(Math.ceil(low / 5) * 5, Math.min(Math.floor(high / 5) * 5, Math.round(median * factor / 5) * 5));
  result.hidden = false;
  result.className = 'result';
  result.replaceChildren(
    el('div', `$${suggested}`, 'result-rate'),
    el('h3', 'A sample rate estimate'),
    el('p', `Based on the comparable median you entered ($${median}) and the demand level you chose, the visible rule suggests $${suggested} for this night.`),
    el('p', 'The market data is yours to verify. This preview has no live AI explanation, database read-back or external pricing feed.'),
    el('small', 'Preview calculation only. No listing price has been changed.')
  );
}

function updateStats(stats) {
  if (!stats || stats.completed == null) return;
  count.textContent = Number(stats.completed).toLocaleString();
  const change = stats.averageChange;
  detail.textContent = change == null ? 'No completed analyses yet.' :
    `Average suggested change: ${change >= 0 ? '+' : '−'}$${Math.abs(change)} per night across completed analyses. This is not realised income.`;
}

try {
  const response = await fetch('/api/stats');
  const data = await response.json();
  if (data.mode === 'live') {
    liveAvailable = true;
    status.textContent = 'LIVE SERVICE';
    updateStats(data);
  } else {
    status.textContent = 'PREVIEW MODE';
    detail.textContent = 'Connect Gemini and Supabase on Vercel to enable live analysis.';
    submit.firstChild.textContent = 'Calculate a preview estimate ';
  }
} catch {
  status.textContent = 'PREVIEW MODE';
  detail.textContent = 'Live analysis is unavailable in this preview.';
  submit.firstChild.textContent = 'Calculate a preview estimate ';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form).entries());
  if (!liveAvailable) return showPreview(values);
  submit.disabled = true;
  submit.firstChild.textContent = 'Analysing… ';
  try {
    const response = await fetch('/api/price', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    const data = await response.json();
    if (!response.ok) return showError(data.error || 'Analysis unavailable.');
    showResult(data);
  } catch {
    showError('The live service could not be reached. Please try again later.');
  } finally {
    submit.disabled = false;
    submit.firstChild.textContent = 'Get an explained estimate ';
  }
});
