export default {
  name: 'ping',
  description: 'Ping command',
  async execute(message: any, args: string[]) {
    await message.reply('Pong!');
  }
};
