/**
 * Token usage tracking & cost calculation — DeepSeek pricing.
 */
const { getDb } = require('./db');
const { getModelPricing } = require('./api');

const USD_CNY_RATE = 7.3;

function recordUsage(model, tokensInput, tokensOutput) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const existing = db.prepare(
    'SELECT id, tokens_input, tokens_output, request_count FROM usage_log WHERE date = ? AND model = ?'
  ).get(today, model);

  if (existing) {
    db.prepare(`
      UPDATE usage_log
      SET tokens_input = tokens_input + ?,
          tokens_output = tokens_output + ?,
          request_count = request_count + 1
      WHERE id = ?
    `).run(tokensInput, tokensOutput, existing.id);
  } else {
    db.prepare(`
      INSERT INTO usage_log (date, model, tokens_input, tokens_output, request_count)
      VALUES (?, ?, ?, ?, 1)
    `).run(today, model, tokensInput, tokensOutput);
  }
}

function getStats(period = 'month') {
  const db = getDb();
  let dateFilter;
  if (period === 'today') {
    dateFilter = "date = date('now','localtime')";
  } else if (period === 'month') {
    dateFilter = "date >= date('now','start of month','localtime')";
  } else if (period === '14d') {
    dateFilter = "date >= date('now','-14 days','localtime')";
  } else {
    dateFilter = '1=1';
  }

  const rows = db.prepare(
    `SELECT date, model, tokens_input, tokens_output, request_count FROM usage_log WHERE ${dateFilter} ORDER BY date DESC`
  ).all();

  let totalInput = 0;
  let totalOutput = 0;
  let totalRequests = 0;
  let totalCostUsd = 0;

  const dailyMap = {};
  rows.forEach(row => {
    totalInput += row.tokens_input;
    totalOutput += row.tokens_output;
    totalRequests += row.request_count;

    const pricing = getModelPricing(row.model);
    const cost = (row.tokens_input / 1e6) * pricing.input + (row.tokens_output / 1e6) * pricing.output;
    totalCostUsd += cost;

    if (!dailyMap[row.date]) {
      dailyMap[row.date] = { date: row.date, tokensInput: 0, tokensOutput: 0, requests: 0, costUsd: 0, models: new Set() };
    }
    dailyMap[row.date].tokensInput += row.tokens_input;
    dailyMap[row.date].tokensOutput += row.tokens_output;
    dailyMap[row.date].requests += row.request_count;
    dailyMap[row.date].costUsd += cost;
    dailyMap[row.date].models.add(row.model);
  });

  const daily = Object.values(dailyMap)
    .map(d => ({
      ...d,
      models: [...d.models],
      costCny: +(d.costUsd * USD_CNY_RATE).toFixed(2),
      tokensTotal: d.tokensInput + d.tokensOutput,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalTokensInput: totalInput,
    totalTokensOutput: totalOutput,
    totalTokens: totalInput + totalOutput,
    totalRequests,
    totalCostUsd: +totalCostUsd.toFixed(4),
    totalCostCny: +(totalCostUsd * USD_CNY_RATE).toFixed(2),
    daily,
    rows: rows.map(r => ({
      ...r,
      costCny: +(
        (r.tokens_input / 1e6) * getModelPricing(r.model).input * USD_CNY_RATE +
        (r.tokens_output / 1e6) * getModelPricing(r.model).output * USD_CNY_RATE
      ).toFixed(2),
    })),
  };
}

module.exports = { recordUsage, getStats, USD_CNY_RATE };
