import mongoose from 'mongoose';

export class Mongo {
  uri: string;
  constructor(uri: string) {
    this.uri = uri;
  }

  async connect() {
    if (!this.uri) {
      console.warn('MONGO_URI not provided; skipping mongo connect');
      return;
    }
    try {
      await mongoose.connect(this.uri, { autoIndex: true });
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('Mongo connection error:', err);
    }
  }
}
