import { Client } from 'discord.js';
import fs from 'fs';
import path from 'path';

export function commandHandler(client: Client, commandsPath: string) {
  if (!fs.existsSync(commandsPath)) return;
  const categories = fs.readdirSync(commandsPath, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  for (const category of categories) {
    const dir = path.join(commandsPath, category);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    for (const file of files) {
      const cmd = require(path.join(dir, file));
      if (cmd?.default) {
        client.commands.set(cmd.default.name, cmd.default);
      } else if (cmd?.name) {
        client.commands.set(cmd.name, cmd);
      }
    }
  }
}
