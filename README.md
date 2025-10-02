# Discord Bot - TypeScript (Modüler)

Bu proje, `!` prefix'i kullanan, modüler komut ve event yapısına sahip bir Discord botu iskeletidir.

Özellikler

- Komutlar kategori dizinleri altında toplanır (ör. `src/commands/util`, `src/commands/fun`).
- Senkron gerektiren veriler MongoDB'ye kaydedilir.
- Senkron gerektirmeyen/veri eşzamansızlığı sorun olmayan veriler `data/*.json` dosyalarına kaydedilir.

Başlangıç

1. Node paketlerini yükleyin:

```powershell
npm install
```

2. Ortam değişkenlerini ayarlayın (ör. `.env` veya sistem ortamı):

- `BOT_TOKEN` - Discord bot token
- `MONGO_URI` (isteğe bağlı) - MongoDB bağlantı URI'sı

3. Geliştirici modunda çalıştırın:

```powershell
npm run dev
```

Yapı

- `src/bot.ts` - bot başlangıcı, komut/event loader ve storage başlatma
- `src/commands/*` - kategori bazlı komutlar
- `src/events/*` - event handlerlar
- `src/storage/mongo.ts` - Mongo wrapper
- `src/storage/jsonStorage.ts` - local json storage

Komut ekleme

1. `src/commands/<kategori>/<komut>.ts` oluşturun.
2. Default export olarak `{ name: string, description?: string, execute: async (message, args) => {} }` yapısını kullanın.
# Hisse Alım Simulator
yakında
