import fs from 'fs';
import path from 'path';
import yf from 'yahoo-finance2';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export default {
  name: 'borsa',
  description: 'BIST hisse listesini getirir. Kullanım: !borsa <bist>',
  async execute(message: any, args: string[]) {
    const query = args[0];
    if (!query) return await message.reply('Kullanım: !borsa <bist> [hisse]');
    if (query.toLowerCase() !== 'bist') return await message.reply('Şu an yalnızca `bist` destekleniyor');

    const file = path.join(process.cwd(), 'data', 'bist.json');
    if (!fs.existsSync(file)) {
      const sample = [
        { symbol: 'AKBNK.IS', name: 'Akbank' },
        { symbol: 'GARAN.IS', name: 'Garanti Bankası' },
        { symbol: 'ISCTR.IS', name: 'İş Bankası (C)' },
        { symbol: 'THYAO.IS', name: 'Türk Hava Yolları' }
      ];
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(sample, null, 2), 'utf8');
      return await message.reply('`data/bist.json` oluşturuldu. İçine göstermek istediğiniz hisseleri ekleyin ve tekrar deneyin.');
    }

    try {
      const raw = fs.readFileSync(file, 'utf8');
      const arr = JSON.parse(raw) as Array<{ symbol: string; name?: string }>;
      if (!arr || !arr.length) return await message.reply('`data/bist.json` boş. Lütfen hisse ekleyin.');

      // If user provided a second arg, treat it as a search for a specific stock by symbol or name
      const searchTerm = args.slice(1).join(' ').trim();
      if (searchTerm) {
        const found = arr.find(a => {
          const s = a.symbol?.toLowerCase() ?? '';
          const n = (a.name ?? '').toLowerCase();
          const q = searchTerm.toLowerCase();
          return s === q || s.includes(q) || n.includes(q);
        });

        if (!found) return await message.reply('Aranan hisse bulunamadı. Lütfen `data/bist.json` içindeki isim veya sembol ile deneyin.');

        try {
          const q: any = await yf.quote(found.symbol);
          const price = (q && (q.regularMarketPrice ?? q.regularMarketPreviousClose ?? q.ask ?? q.bid)) ?? null;
          const change = q && q.regularMarketChange !== undefined ? q.regularMarketChange : null;
          const changePct = q && q.regularMarketChangePercent !== undefined ? q.regularMarketChangePercent : null;

          const embed = new EmbedBuilder()
            .setTitle(`${found.name || found.symbol} — ${found.symbol}`)
            .addFields(
              { name: 'Fiyat', value: price != null ? String(price) : '—', inline: true },
              { name: 'Değişim', value: change != null ? `${Number(change).toFixed(2)} (${changePct != null ? (Number(changePct) * 100).toFixed(2) + '%' : '—'})` : '—', inline: true }
            )
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`borsa_chart:${found.symbol}`).setLabel('Grafik Göster').setStyle(ButtonStyle.Primary)
          );

          await message.channel.send({ embeds: [embed], components: [row] });
        } catch (e: any) {
          console.error('yahoo quote err', e);
          return await message.reply('Hisse verileri alınırken hata oluştu');
        }

        return;
      }

      // otherwise list all symbols with current prices
      const symbols = arr.map(a => a.symbol);
      const pricesMap: Record<string, string> = {};
      const concurrency = 5;
      const tasks: Array<() => Promise<void>> = [];

      for (const sym of symbols) {
        tasks.push(async () => {
          try {
            const q: any = await yf.quote(sym);
            const price = (q && (q.regularMarketPrice ?? q.regularMarketPreviousClose ?? q.ask ?? q.bid)) ?? null;
            pricesMap[sym] = price != null ? Number(price).toString() : '—';
          } catch (e: any) {
            console.warn('yahoo-finance2 fetch failed for', sym, e?.toString?.());
            pricesMap[sym] = '—';
          }
        });
      }

      for (let i = 0; i < tasks.length; i += concurrency) {
        await Promise.all(tasks.slice(i, i + concurrency).map(fn => fn()));
      }

      const lines = arr.map(it => `${it.symbol} — ${it.name || ''} — ${pricesMap[it.symbol] ?? '—'}`);
      const content = lines.join('\n');
      await message.channel.send({ content, split: { char: '\n', maxLength: 1900 } });
    } catch (err) {
      console.error('borsa file err', err);
      await message.reply('Dosya okunurken hata oluştu');
    }
  }
};
