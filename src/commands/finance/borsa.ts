import axios from 'axios';

export default {
  name: 'borsa',
  description: 'BIST hisse listesini getirir. Kullanım: !borsa <bist>',
  async execute(message: any, args: string[]) {
    const query = args[0];
    if (!query) return await message.reply('Kullanım: !borsa <bist>');
    if (query.toLowerCase() !== 'bist') return await message.reply('Şu an yalnızca `bist` destekleniyor');

    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=&quotesCount=10000&newsCount=0&enableFuzzyQuery=true&enableCb=true&quotesQueryId=equity`;
      const res = await axios.get(url, { timeout: 10000 });
      const data = res.data;
      if (!data || !data.quotes) return await message.reply('Veri alınamadı');

      const turkish = data.quotes.filter((q: any) => {
        const exch = (q.exchange || '').toLowerCase();
        const short = (q.shortname || q.longname || '').toLowerCase();
        return exch.includes('bist') || exch.includes('istanbul') || short.includes('bist') || (q.symbol && (q.symbol.endsWith('.IS') || q.symbol.endsWith('.IST')));
      });

      if (!turkish.length) return await message.reply('BIST için hisse bulunamadı');

      const lines = turkish.map((t: any) => `${t.symbol} — ${t.shortname || t.longname || ''}`);
      const content = lines.join('\n');

      // Discord has message length limits; use split option
      await message.channel.send({ content, split: { char: '\n', maxLength: 1900 } });

    } catch (err) {
      console.error('borsa err', err);
      await message.reply('Hata oluştu veri çekerken');
    }
  }
};
