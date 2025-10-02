import { EmbedBuilder } from 'discord.js';

export default {
  name: 'discord',
  description: 'Show the invite link for the Discord server',
  async execute(message: any, args: string[]) {
    const inviteUrl = 'https://discord.gg/6t7FkWjk';
    const embed = new EmbedBuilder()
      .setTitle('Join our Discord Community')
      .setDescription(`Click the button below or use the invite link to join:`)
      .addFields({ name: 'Invite', value: `[Join Here](${inviteUrl})`, inline: true })
      .setColor(0x5865F2)
      .setFooter({ text: 'Hisse Alım Sim' })
      .setTimestamp();

    try {
      await message.reply({ embeds: [embed] });
    } catch (err) {
      console.warn('Failed to send discord invite embed', err);
      await message.reply(`Join here: ${inviteUrl}`);
    }
  }
};
