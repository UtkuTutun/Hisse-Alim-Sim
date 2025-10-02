import { Message } from 'discord.js';

const prefix = '!';

export default {
  event: 'messageCreate',
  async execute(message: Message) {
    if (message.author?.bot) return;
    if (!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const cmdName = args.shift()?.toLowerCase();
  if (!cmdName) return;
  const cli = message.client as any;
  const cmd = cli.commands?.get(cmdName);
    if (!cmd) return;
    try {
      await cmd.execute(message, args);
    } catch (err) {
      console.error('command error', err);
      await message.reply('Komutu çalıştırırken hata oluştu');
    }
  }
};
