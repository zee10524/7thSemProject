import mongoose from 'mongoose';
import type { Logger } from './logger.js';
import '../models/index.js';

// Unknown filter keys are dropped. Injection safety comes from Zod-typed inputs and $eq on user strings.
mongoose.set('strictQuery', true);

/** Connects and builds every declared index (autoIndex is off so this happens once, at boot). */
export async function connectMongo(uri: string, logger: Logger): Promise<void> {
  mongoose.connection.on('disconnected', () => logger.warn('mongo disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('mongo reconnected'));
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10_000, maxPoolSize: 20 });
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
  logger.info({ db: mongoose.connection.name }, 'mongo connected');
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
