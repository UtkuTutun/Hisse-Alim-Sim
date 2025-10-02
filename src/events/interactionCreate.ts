import { Interaction, ButtonInteraction, StringSelectMenuInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import yf from 'yahoo-finance2';
import fs from 'fs';
import path from 'path';
import chartCache from '../storage/chartCache';
import logger from '../utils/logger';
import chartRenderer from '../utils/chartRenderer';

function safeFilename(s: string) {
  return s.replace(/[^a-z0-9\.\-]/gi, '_');
}

export default {
  event: 'interactionCreate',
  async execute(interaction: Interaction) {
    // only care about our button and select menu
    // (use duck typing because Interaction types are unions)
    try {
      // Button: show the interval select menu
      if ((interaction as any).isButton && (interaction as any).isButton()) {
        const btn = interaction as ButtonInteraction;
        const id = btn.customId ?? '';
        if (!id.startsWith('borsa_chart:')) return;
  const symbolRaw = id.split(':')[1];
  if (!symbolRaw) return;
  const symbol = symbolRaw.trim().toUpperCase();

        // Note: map "1 gün" to a 5m intraday series across the last 24h (user expects 1-day candles)
        // provide an explicit "Günlük (kapanış)" option if they want daily-close series instead
        const menu = new StringSelectMenuBuilder()
          .setCustomId(`borsa_chart_select:${symbol}`)
          .setPlaceholder('Periyot seçin')
          .addOptions([
            { label: '1 gün (5m mumlar)', value: `run:${symbol}:5m`, description: 'Son 24 saat, 5 dakika mumlar' },
            { label: '1 gün (15m mumlar)', value: `run:${symbol}:15m`, description: 'Son 24 saat, 15 dakika mumlar' },
            { label: '1 gün (1h mumlar)', value: `run:${symbol}:1h`, description: 'Son 24 saat, 1 saat mumlar' },
            { label: 'Günlük (kapanış)', value: `run:${symbol}:1d`, description: 'Günlük kapanış serisi (line)' }
          ]);
        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
        try {
          await btn.reply({ content: `Hangi periyodu görmek istiyorsunuz? (${symbol})`, components: [row], ephemeral: true });
        } catch (err) {
          logger.log('error', 'failed to send select menu', { err: String(err), symbol });
        }
        return;
      }

      // Select menu: user chose interval -> generate chart
      if ((interaction as any).isStringSelectMenu && (interaction as any).isStringSelectMenu()) {
        const sel = interaction as StringSelectMenuInteraction;
        const value = sel.values?.[0];
        if (!value || !value.startsWith('run:')) return;
  const parts = value.split(':');
  const symbol = (parts[1] ?? '').trim().toUpperCase();
        const interval = parts[2] ?? '5m';
        try {
          if (!sel.deferred && !sel.replied) await sel.deferReply({ ephemeral: true } as any);
        } catch (err) {
          logger.log('warn', 'deferReply failed for select', { err: String(err), symbol, interval });
        }
        await handleChartRequest(symbol, interval, sel);
        return;
      }
    } catch (err) {
      logger.log('error', 'interaction handler failed', { err: String((err as any) || '' ) });
    }
  }
};

async function handleChartRequest(symbol: string, interval: string, interaction: any) {
  const sym = (symbol ?? '').trim().toUpperCase();
  const cacheKey = `${sym}:${interval}`;
  try {
    logger.log('info', 'chart request', { symbol: sym, interval });

    // check cache
    const cached = chartCache.getChart(cacheKey);
    if (cached) {
      try {
        if (cached.url) {
          const embed = new EmbedBuilder()
            .setTitle(`${sym} — ${interval} Grafik`)
            .setImage(cached.url)
            .setFooter({ text: 'cache' })
            .setTimestamp();
          await interaction.editReply({ embeds: [embed] });
          return;
        }
        if (cached.buffer) {
          await interaction.editReply({ files: [{ attachment: cached.buffer, name: `${safeFilename(sym)}_${interval}_chart.png` }] as any });
          return;
        }
      } catch (err) {
        logger.log('warn', 'failed to send cached chart', { err: String(err), symbol: sym, interval });
      }
    }

    // Fetch OHLC data from Yahoo Finance
    const now = new Date();
    const period2 = now;
    const period1 = new Date(now.getTime() - 24 * 60 * 60 * 1000); // default last 24h for intraday
    let yfRes: any;
    try {
      const intradayIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h'];
      if (intradayIntervals.includes(interval)) {
        // prefer range: '1d' for intraday queries (yahoo-finance2 supports range+interval)
        yfRes = await yf.chart(sym, { range: '1d', interval, includePrePost: false } as any);
      } else {
        yfRes = await yf.chart(sym, { period1, period2, interval, includePrePost: false } as any);
      }
    } catch (err) {
      logger.log('warn', 'yf.chart intraday failed, will try daily fallback', { err: String(err), symbol: sym, interval });
      yfRes = null;
    }

    // Parse candles (intraday) if returned
    const candles: Array<{ date: Date; open: number; high: number; low: number; close: number }> = [];
    // New shape: { meta, quotes: [{ date, open, high, low, close, ...}, ...] }
    if (yfRes && yfRes.meta && Array.isArray(yfRes.quotes)) {
      for (const q of yfRes.quotes) {
        const d = q?.date ? new Date(q.date) : undefined;
        const o = q?.open; const h = q?.high; const l = q?.low; const c = q?.close;
        if (d && [o, h, l, c].every(v => v !== null && v !== undefined && Number.isFinite(v))) {
          candles.push({ date: d, open: o, high: h, low: l, close: c });
        }
      }
    } else if (yfRes && yfRes.chart && Array.isArray(yfRes.chart.result) && yfRes.chart.result[0]) {
      const result = yfRes.chart.result[0];
      const timestamps: number[] = result.timestamp ?? [];
      const quote = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
      const opens = quote.open ?? [];
      const highs = quote.high ?? [];
      const lows = quote.low ?? [];
      const closes = quote.close ?? [];
      const len = Math.min(timestamps.length, opens.length, highs.length, lows.length, closes.length);
      for (let i = 0; i < len; i++) {
        const t = timestamps[i];
        const o = opens[i];
        const h = highs[i];
        const l = lows[i];
        const c = closes[i];
        if ([t, o, h, l, c].every(v => v !== null && v !== undefined && Number.isFinite(v))) {
          candles.push({ date: new Date(t * 1000), open: o, high: h, low: l, close: c });
        }
      }
    } else if (yfRes && Array.isArray(yfRes) && yfRes.length && yfRes[0].timestamp) {
      // older shape
      const result = yfRes[0];
      const timestamps: number[] = result.timestamp ?? [];
      const quote = result.indicators?.quote?.[0] ?? {};
      const opens = quote.open ?? [];
      const highs = quote.high ?? [];
      const lows = quote.low ?? [];
      const closes = quote.close ?? [];
      const len = Math.min(timestamps.length, opens.length, highs.length, lows.length, closes.length);
      for (let i = 0; i < len; i++) {
        const t = timestamps[i];
        const o = opens[i];
        const h = highs[i];
        const l = lows[i];
        const c = closes[i];
        if ([t, o, h, l, c].every(v => v !== null && v !== undefined && Number.isFinite(v))) {
          candles.push({ date: new Date(t * 1000), open: o, high: h, low: l, close: c });
        }
      }
    }

    // Helper: locally render chart using PNG generator; returns true if sent
    async function trySendChart(chartConfig: any, title: string) {
      try {
        if (chartConfig?.type === 'candlestick') {
          const data = (chartConfig?.data?.datasets?.[0]?.data || []) as any[];
          const candles = data.map(d => ({ x: new Date(d.x), o: d.o, h: d.h, l: d.l, c: d.c }));
          const buffer = await chartRenderer.renderCandles(title, candles);
          chartCache.setChartBuffer(cacheKey, buffer);
          await interaction.editReply({ files: [{ attachment: buffer, name: `${safeFilename(sym)}_chart.png` }] as any });
          return true;
        } else if (chartConfig?.type === 'line') {
          const labels = (chartConfig?.data?.labels || []) as any[];
          const pointsRaw = (chartConfig?.data?.datasets?.[0]?.data || []) as number[];
          const points = labels.map((l, i) => ({ x: new Date(l), y: Number(pointsRaw[i] ?? 0) }));
          const buffer = await chartRenderer.renderLine(title, points);
          chartCache.setChartBuffer(cacheKey, buffer);
          await interaction.editReply({ files: [{ attachment: buffer, name: `${safeFilename(sym)}_chart.png` }] as any });
          return true;
        }
      } catch (e) {
        logger.log('error', 'local chart render failed', { err: String(e), symbol: sym, interval });
      }
      return false;
    }

    // If the user explicitly asked for daily series, handle as daily-candlestick (preferred) directly.
    if (interval === '1d') {
      logger.log('info', 'interval=1d requested, using daily series path', { symbol: sym });
      // fetch daily OHLC
      const period1Daily = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); // 180 days
      try {
        const daily = await yf.chart(sym, { period1: period1Daily, period2: now, interval: '1d', includePrePost: false } as any);
        let dailyCandles: Array<{ date: Date; open: number; high: number; low: number; close: number }> = [];
        if ((daily as any)?.meta && Array.isArray((daily as any)?.quotes)) {
          for (const q of (daily as any).quotes) {
            const d = q?.date ? new Date(q.date) : undefined;
            const o = q?.open; const h = q?.high; const l = q?.low; const c = q?.adjclose ?? q?.close;
            if (d && [o, h, l, c].every(v => v !== null && v !== undefined && Number.isFinite(v))) {
              dailyCandles.push({ date: d, open: o, high: h, low: l, close: c });
            }
          }
        } else {
          const result = (daily as any)?.chart?.result?.[0] ?? (daily as any)?.result?.[0] ?? null;
          if (!result) {
            logger.log('warn', 'daily requested: no result from yahoo', { symbol: sym, raw: daily });
            await interaction.editReply('Grafik verisi bulunamadı');
            return;
          }
          const timestamps: number[] = result.timestamp ?? result?.timestamp ?? [];
          const quote = result?.indicators?.quote?.[0] ?? result?.indicators?.quote ?? {};
          const opens = quote.open ?? [];
          const highs = quote.high ?? [];
          const lows = quote.low ?? [];
          const closes = quote.close ?? result?.indicators?.adjclose?.[0]?.adjclose ?? [];
          const len = Math.min((timestamps || []).length, (opens || []).length, (highs || []).length, (lows || []).length, (closes || []).length);
          for (let i = 0; i < len; i++) {
            const t = timestamps[i];
            const o = opens[i];
            const h = highs[i];
            const l = lows[i];
            const c = closes[i];
            if (t && [o, h, l, c].every(v => v !== null && v !== undefined && Number.isFinite(v))) dailyCandles.push({ date: new Date(t * 1000), open: o, high: h, low: l, close: c });
          }
        }
        if (!dailyCandles.length) {
          const diag: any = { symbol: sym };
          try {
            const d: any = daily as any;
            diag.shapeKeys = Object.keys(d || {});
            diag.quotesLen = Array.isArray(d?.quotes) ? d.quotes.length : undefined;
          } catch {}
          logger.log('warn', 'daily (explicit) produced zero daily candles', diag);
          await interaction.editReply('Grafik verisi bulunamadı');
          return;
        }
        const slice = dailyCandles.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(Math.max(0, dailyCandles.length - 60));
        const qcData = slice.map(c => ({ x: c.date.toISOString(), o: c.open, h: c.high, l: c.low, c: c.close }));
        const chartConfig = {
          type: 'candlestick',
          data: { datasets: [{ label: sym, data: qcData, type: 'candlestick' }] },
          options: {
            parsing: false,
            plugins: { legend: { display: false } },
            scales: { x: { type: 'timeseries' }, y: { title: { display: true, text: 'Fiyat' } } }
          }
        };
        const sent = await trySendChart(chartConfig, `${sym} — 1G Günlük Mum Grafiği`);
        if (sent) return;
        // if not sent, fall back to a line chart using closes
        const labels = slice.map(p => `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}-${String(p.date.getDate()).padStart(2, '0')}`);
        const data = slice.map(p => p.close);
        const lineConfig = { type: 'line', data: { labels, datasets: [{ label: sym, data, fill: false, borderColor: '#0aa', backgroundColor: '#0aa', tension: 0.2 }] } };
        const sent2 = await trySendChart(lineConfig, `${sym} — 1G Günlük Grafik`);
        if (sent2) return;
        await interaction.editReply('Grafik oluşturulamadı');
        return;
      } catch (dailyErr) {
        logger.log('error', 'daily explicit fallback failed', { err: String(dailyErr), symbol: sym });
        await interaction.editReply('Grafik verisi alınırken hata oluştu');
        return;
      }
    }

    // If no intraday candles found and interval is intraday, fallback to daily line chart (6 months)
    const intradayIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h'];
    if (candles.length === 0 && intradayIntervals.includes(interval)) {
      logger.log('info', 'no intraday candles, fetching daily series for fallback', { symbol: sym, interval });
      const period1Daily = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); // 180 days
      try {
        const daily = await yf.chart(sym, { period1: period1Daily, period2: now, interval: '1d', includePrePost: false } as any);
        let dailyCandles: Array<{ date: Date; open: number; high: number; low: number; close: number }> = [];
        if ((daily as any)?.meta && Array.isArray((daily as any)?.quotes)) {
          for (const q of (daily as any).quotes) {
            const d = q?.date ? new Date(q.date) : undefined;
            const o = q?.open; const h = q?.high; const l = q?.low; const c = q?.adjclose ?? q?.close;
            if (d && [o, h, l, c].every(v => v !== null && v !== undefined && Number.isFinite(v))) {
              dailyCandles.push({ date: d, open: o, high: h, low: l, close: c });
            }
          }
        } else {
          const result = (daily as any)?.chart?.result?.[0] ?? (daily as any)?.result?.[0] ?? null;
          if (!result) {
            logger.log('warn', 'daily fallback: no result from yahoo', { symbol: sym, raw: daily });
            await interaction.editReply('Grafik verisi bulunamadı');
            return;
          }
          const timestamps: number[] = result.timestamp ?? result?.timestamp ?? [];
          const quote = result?.indicators?.quote?.[0] ?? result?.indicators?.quote ?? {};
          const opens = quote.open ?? [];
          const highs = quote.high ?? [];
          const lows = quote.low ?? [];
          const closes = quote.close ?? result?.indicators?.adjclose?.[0]?.adjclose ?? [];
          const len = Math.min((timestamps || []).length, (opens || []).length, (highs || []).length, (lows || []).length, (closes || []).length);
          for (let i = 0; i < len; i++) {
            const t = timestamps[i];
            const o = opens[i];
            const h = highs[i];
            const l = lows[i];
            const c = closes[i];
            if (t && [o, h, l, c].every(v => v !== null && v !== undefined && Number.isFinite(v))) {
              dailyCandles.push({ date: new Date(t * 1000), open: o, high: h, low: l, close: c });
            }
          }
        }
          if (!dailyCandles.length) {
            const diag: any = { symbol: sym, interval };
            try {
              const d: any = daily as any;
              diag.shapeKeys = Object.keys(d || {});
              diag.quotesLen = Array.isArray(d?.quotes) ? d.quotes.length : undefined;
            } catch {}
            logger.log('warn', 'daily fallback produced zero candles', diag);
            await interaction.editReply('Grafik verisi bulunamadı');
            return;
          }
          // take last N days
          const lastN = 60;
          const sortedDaily = dailyCandles.sort((a, b) => a.date.getTime() - b.date.getTime());
          const slice = sortedDaily.slice(Math.max(0, sortedDaily.length - lastN));
          const qcData = slice.map(c => ({ x: c.date.toISOString(), o: c.open, h: c.high, l: c.low, c: c.close }));
          const chartConfig = {
            type: 'candlestick',
            data: { datasets: [{ label: sym, data: qcData, type: 'candlestick' }] },
            options: {
              parsing: false,
              plugins: { legend: { display: false } },
              scales: { x: { type: 'timeseries' }, y: { title: { display: true, text: 'Fiyat' } } }
            }
          };
        // render locally
        const sent = await trySendChart(chartConfig, `${sym} — 1G Günlük Grafik`);
        if (!sent) await interaction.editReply('Grafik oluşturulamadı');
        return;
      } catch (dailyErr) {
        logger.log('error', 'daily fallback failed', { err: String(dailyErr), symbol: sym });
        await interaction.editReply('Grafik verisi alınırken hata oluştu');
        return;
      }
    }

    // If after parsing we still have no candles, log the raw yahoo response for debugging
    if (candles.length === 0) {
      logger.log('warn', 'intraday parsing produced zero candles', { symbol: sym, interval });
      try {
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
        const dumpPath = path.join(logsDir, `yf-${sym.replace(/[^a-z0-9]/gi,'_')}-${interval}-${Date.now()}.json`);
        fs.writeFileSync(dumpPath, JSON.stringify(yfRes ?? { note: 'no-yfRes' }, null, 2), 'utf8');
        logger.log('info', 'wrote yahoo debug dump', { path: dumpPath });
      } catch (e) {
        logger.log('warn', 'failed to write yahoo debug dump', { err: String(e) });
      }
    }

    // Build candlestick chart from candles
    if (candles.length > 0) {
      // convert for QuickChart financial dataset
      const qcData = candles.map(c => ({ x: c.date.toISOString(), o: c.open, h: c.high, l: c.low, c: c.close }));
      const chartConfig = {
        type: 'candlestick',
        data: { datasets: [{ label: sym, data: qcData, type: 'candlestick' }] },
        options: {
          parsing: false,
          plugins: { legend: { display: false } },
          scales: { x: { type: 'timeseries', time: { unit: 'hour' } }, y: { title: { display: true, text: 'Fiyat' } } }
        }
      };

      // Try QuickChart POST -> GET -> binary
      const sentCandle = await trySendChart(chartConfig, `${sym} — ${interval} Mum Grafiği`);
      if (sentCandle) return;
    }

    await interaction.editReply('Grafik oluşturulamadı (veri veya render hatası)');
  } catch (err) {
    logger.log('error', 'handleChartRequest failed', { err: String(err), symbol: sym, interval });
    try {
      await interaction.editReply('Grafik oluşturulurken hata oluştu');
    } catch (e) {
      logger.log('warn', 'failed to edit reply after error', { err: String(e) });
    }
  }
}

