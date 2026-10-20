import { MongoMemoryServer } from 'mongodb-memory-server';

let server: MongoMemoryServer | undefined;

/**
 * One MongoDB for the run; each test file uses its own database on it. Uses mongodb-memory-server
 * unless TEST_MONGO_URI already points at a server (for example `docker compose up mongo`).
 */
export async function setup(): Promise<void> {
  if (process.env.TEST_MONGO_URI) return;
  server = await MongoMemoryServer.create();
  process.env.TEST_MONGO_URI = server.getUri();
}

export async function teardown(): Promise<void> {
  await server?.stop();
}
