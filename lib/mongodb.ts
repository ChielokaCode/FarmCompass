import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "farmcompass";

declare global {
  // eslint-disable-next-line no-var
  var _farmCompassMongoPromise: Promise<MongoClient> | undefined;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGODB_URI is not configured");
  if (!global._farmCompassMongoPromise) {
    const client = new MongoClient(uri);
    global._farmCompassMongoPromise = client.connect();
  }
  return global._farmCompassMongoPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}
