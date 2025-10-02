import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { commandHandler, eventHandler } from './handlers';
import { Mongo, JsonStorage } from './storage';

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN not set in environment');
  process.exit(1);
}

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

// Collections for commands
client.commands = new Collection();

// Initialize storages
export const mongo = new Mongo(process.env.MONGO_URI || '');
export const jsonStorage = new JsonStorage(path.join(process.cwd(), 'data'));

// Load handlers
commandHandler(client, path.join(__dirname, 'commands'));
eventHandler(client, path.join(__dirname, 'events'));

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  await mongo.connect();
});

client.login(token).catch(err => {
  console.error('Failed to login:', err);
});
