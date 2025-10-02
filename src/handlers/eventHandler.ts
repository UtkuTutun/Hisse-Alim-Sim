import { Client } from 'discord.js';
import fs from 'fs';
import path from 'path';

export function eventHandler(client: Client, eventsPath: string) {
  if (!fs.existsSync(eventsPath)) return;
  const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  for (const file of files) {
    const ev = require(path.join(eventsPath, file));
    const handler = ev?.default ?? ev;
    if (!handler || !handler.event || !handler.execute) continue;
    if (handler.once) client.once(handler.event, (...args: any[]) => handler.execute(...args));
    else client.on(handler.event, (...args: any[]) => handler.execute(...args));
  }
}
