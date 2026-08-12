import seedData from "@/data/crops.seed.json";
import { getDb } from "@/lib/mongodb";
import type { CropRecord } from "@/types";

const seed = seedData as CropRecord[];

export async function listCrops(): Promise<CropRecord[]> {
  if (!process.env.MONGODB_URI) return seed;
  try {
    const db = await getDb();
    const docs = await db.collection<CropRecord>("crops").find({ active: { $ne: false } }).sort({ name: 1 }).toArray();
    return docs.length ? docs.map((x) => ({ ...x, _id: String(x._id) })) : seed;
  } catch {
    return seed;
  }
}

export async function getCropBySlug(slug: string): Promise<CropRecord | null> {
  if (process.env.MONGODB_URI) {
    try {
      const db = await getDb();
      const doc = await db.collection<CropRecord>("crops").findOne({ slug, active: { $ne: false } });
      if (doc) return { ...doc, _id: String(doc._id) };
    } catch {
      // Local seed fallback keeps public crop pages available while the DB is being configured.
    }
  }
  return seed.find((c) => c.slug === slug) || null;
}
