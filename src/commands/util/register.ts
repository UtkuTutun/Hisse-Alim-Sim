import { client, mongo, jsonStorage } from '../../bot';
import UserModel from '../../models/user';

export default {
  name: 'register',
  description: 'Register a user in synced storage',
  async execute(message: any, args: string[]) {
    const id = message.author.id;
    if (mongo.uri) {
      // save to mongo
      try {
        await UserModel.create({ discordId: id, createdAt: new Date() });
        await message.reply('Registered in MongoDB');
        return;
      } catch (err) {
        console.error('mongo save err', err);
      }
    }
    // fallback to json
    const existing = jsonStorage.read('users') || {};
    existing[id] = { discordId: id, createdAt: new Date() };
    jsonStorage.write('users', existing);
    await message.reply('Registered locally (json)');
  }
};
