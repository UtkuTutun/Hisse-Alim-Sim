import { client } from '../bot';
import presenceConfig from '../config/presence.json';
import { ActivityType } from 'discord.js';

let intervalRef: NodeJS.Timeout | null = null;

export default {
  event: 'ready',
  once: true,
  execute() {
    console.log('Bot is ready');

    const rotate = () => {
      const guilds = client.guilds.cache.size;
      const presences = presenceConfig.presences as Array<{ name: string; type: string }>;
      const presenceIntervalMs = presenceConfig.presenceIntervalMs as number;
      const idx = Math.floor(Date.now() / presenceIntervalMs) % presences.length;
      const p = presences[idx];
      const name = p.name.replace('{guilds}', String(guilds));
      try {
        // map string type to ActivityType; default to Custom
        const type = ActivityType.Custom;
        client.user?.setPresence({ activities: [{ name, type } as any], status: 'online' });
      } catch (err) {
        console.warn('Failed to set presence', err);
      }
    };

    // initial set
    rotate();
    // rotate every presenceIntervalMs
  if (intervalRef) clearInterval(intervalRef);
  intervalRef = setInterval(rotate, presenceConfig.presenceIntervalMs as number);
  }
};
