import { Interaction, ButtonInteraction, EmbedBuilder } from 'discord.js';
import yf from 'yahoo-finance2';
import axios from 'axios';

export default {
  event: 'interactionCreate',
  async execute(interaction: Interaction) {
    // Only handle button interactions
    if (typeof (interaction as any).isButton !== 'function' || !(interaction as any).isButton()) return;

    const btn = interaction as ButtonInteraction;
    const id = btn.customId ?? '';
    if (!id.startsWith('borsa_chart:')) return;

    const symbol = id.split(':')[1];
    if (!symbol) {
      try {
        if (!btn.deferred && !btn.replied) await btn.reply({ content: 'Sembol bilinmiyor', ephemeral: true });
      } catch (err) {
        console.warn('failed to reply unknown symbol', err);
      }
      return;
    }

    // Acknowledge the interaction to avoid the "Interaction failed" message
    try {
      if (!btn.deferred && !btn.replied) await btn.deferReply({ ephemeral: true });
    } catch (err) {
      console.error('deferReply failed', err);
      try {
        if (!btn.replied) await btn.reply({ content: 'İşlem başlatılamadı (defer). Lütfen tekrar deneyin.', ephemeral: true });
      } catch (replyErr) {
        console.warn('fallback reply also failed', replyErr);
      }
      return;
    }

    try {
      const hist: any[] = await yf.historical(symbol, { period: '6mo' } as any);
      if (!hist || !hist.length) {
        return await btn.editReply('Grafik için veri bulunamadı');
      }

      const sorted = hist.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const labels = sorted.map(s => {
        const d = new Date(s.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      });
      const data = sorted.map(s => (s.close ?? s.adjclose ?? s.close) as number);

      const chartConfig = {
        type: 'line',
        data: { labels, datasets: [{ label: symbol, data, fill: false, borderColor: '#00aaff', backgroundColor: '#00aaff', tension: 0.2 }] },
        options: { scales: { x: { display: true, title: { display: true, text: 'Tarih' } }, y: { display: true, title: { display: true, text: 'Fiyat' } } } }
      };

      let url: string | undefined;
      try {
        const resp = await axios.post('https://quickchart.io/chart/create', { chart: chartConfig, width: 800, height: 400, format: 'png', backgroundColor: 'white' });
        url = resp?.data?.url;
      } catch (postErr) {
        console.warn('QuickChart POST failed, falling back to GET', postErr?.toString?.());
      }

      if (!url) {
        try {
          const encoded = encodeURIComponent(JSON.stringify(chartConfig));
          url = `https://quickchart.io/chart?c=${encoded}&width=800&height=400&devicePixelRatio=2`;
        } catch (encErr) {
          console.error('encoding chart config failed', encErr);
        }
      }

      if (!url || typeof url !== 'string') {
        await btn.editReply('Grafik oluşturulamadı (URL alınamadı)');
        return;
      }

      const embed = new EmbedBuilder().setTitle(`${symbol} — Grafik`).setImage(url).setTimestamp();
      await btn.editReply({ embeds: [embed] });
    } catch (e: any) {
      console.error('chart err', e);
      try {
        await btn.editReply('Grafik oluşturulurken hata oluştu');
      } catch (editErr) {
        console.warn('failed to edit reply after chart error', editErr);
      }
    }
  }
};
import { Interaction, ButtonInteraction, EmbedBuilder } from 'discord.js';
import yf from 'yahoo-finance2';
import axios from 'axios';

export default {
  event: 'interactionCreate',
  async execute(interaction: Interaction) {
  if (!('isButton' in interaction) || !interaction.isButton()) return;
  const btn = interaction as ButtonInteraction;
    const id = btn.customId ?? '';
    // Safer runtime check: call isButton if it exists (method lives on prototype in discord.js)
    // This avoids false negatives caused by property checks.
    try {
      if (typeof (interaction as any).isButton !== 'function' || !(interaction as any).isButton()) return;
    } catch (checkErr) {
      console.warn('interaction type check failed', checkErr);
      return;
    }

    const symbol = id.split(':')[1];
    if (!symbol) return btn.reply({ content: 'Sembol bilinmiyor', ephemeral: true });

    try {
      await btn.deferReply();
      // Safely reply if possible
      try {
        if (!btn.replied && !btn.deferred) await btn.reply({ content: 'Sembol bilinmiyor', ephemeral: true });
      } catch (rErr) {
        console.warn('failed replying unknown symbol', rErr);
      }
      console.error('deferReply failed', dErr);
      try {
        // Try a fallback reply
        await btn.reply({ content: 'İşlem başlatılamadı (defer). Lütfen tekrar deneyin.', ephemeral: true });
      } catch {}
      if (!btn.deferred && !btn.replied) await btn.deferReply({ ephemeral: true });
    }

    try {
        if (!btn.replied) await btn.reply({ content: 'İşlem başlatılamadı (defer). Lütfen tekrar deneyin.', ephemeral: true });
      const hist: any[] = await yf.historical(symbol, { period: '6mo' } as any);
        console.warn('fallback reply also failed', replyErr);
      if (!hist || !hist.length) {
        return await btn.editReply('Grafik için veri bulunamadı');
      }

      // Sort by date ascending
      const sorted = hist.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const labels = sorted.map(s => {
        const d = new Date(s.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      });
      const data = sorted.map(s => (s.close ?? s.adjclose ?? s.close) as number);

      const chartConfig = {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: symbol,
              data,
              fill: false,
              borderColor: '#00aaff',
              backgroundColor: '#00aaff',
              tension: 0.2
            }
          ]
        },
        options: {
          scales: {
            x: { display: true, title: { display: true, text: 'Tarih' } },
            y: { display: true, title: { display: true, text: 'Fiyat' } }
          }
        }
      };

      // Use QuickChart create endpoint (POST) to avoid very long GET URLs and improve reliability
      let url: string | undefined;
      try {
        const resp = await axios.post('https://quickchart.io/chart/create', {
          chart: chartConfig,
          width: 800,
          height: 400,
          format: 'png',
          backgroundColor: 'white'
        });
        url = resp?.data?.url;
      } catch (postErr) {
        console.warn('QuickChart POST failed, falling back to GET', postErr?.toString?.());
      }

      if (!url) {
        // fallback to GET URL
        try {
          const encoded = encodeURIComponent(JSON.stringify(chartConfig));
          url = `https://quickchart.io/chart?c=${encoded}&width=800&height=400&devicePixelRatio=2`;
        } catch (encErr) {
          console.error('encoding chart config failed', encErr);
        }
      }

      if (!url || typeof url !== 'string') {
        await btn.editReply('Grafik oluşturulamadı (URL alınamadı)');
        return;
      }

      const embed = new EmbedBuilder().setTitle(`${symbol} — Grafik`).setImage(url).setTimestamp();
      await btn.editReply({ embeds: [embed] });
    } catch (e: any) {
      console.error('chart err', e);
      try {
        await btn.editReply('Grafik oluşturulurken hata oluştu');
      } catch {}
    }
  }
};
