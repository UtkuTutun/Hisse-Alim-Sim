const yf = require('yahoo-finance2').default || require('yahoo-finance2');
const fs = require('fs');
(async () => {
  const symbol = process.argv[2] || 'TUPRS.IS';
  const interval = process.argv[3] || '5m';
  const now = new Date();
  const period2 = now;
  const period1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  try {
    console.log(`Fetching ${symbol} ${interval} from ${period1.toISOString()} -> ${period2.toISOString()}`);
    const res = await yf.chart(symbol, { period1, period2, interval, includePrePost: false });
    const out = {
      hasChart: !!res?.chart,
      keys: Object.keys(res || {}),
      sample: null,
    };
    if (res?.chart?.result?.[0]) {
      const r = res.chart.result[0];
      out.sample = {
        timestampLen: (r.timestamp || []).length,
        indicators: Object.keys(r.indicators || {}),
        quoteLen: (r.indicators?.quote?.[0]?.close || []).length
      };
    } else if (Array.isArray(res) && res[0]) {
      const r = res[0];
      out.sample = { timestampLen: (r.timestamp || []).length, indicators: Object.keys(r.indicators || {}) };
    } else {
      out.sample = res;
    }
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    try { fs.writeFileSync('yf-debug.json', JSON.stringify({ error: String(e), stack: e.stack || null }, null, 2)); } catch (err) {}
  }
})();
