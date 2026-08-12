import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";
import seedData from "../data/crops.seed.json";

if (existsSync(".env.local")) loadEnvFile(".env.local");
else if (existsSync(".env")) loadEnvFile(".env");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is missing. Add your MongoDB Atlas connection string to .env.local.");
console.log("MongoDB URI loaded:", uri ? "YES" : "NO");

const dbName = process.env.MONGODB_DB || "farmcompass";
const client = new MongoClient(uri);
const db = client.db(dbName);

async function upsertUser(name:string,email:string,password:string,role:"ADMIN"|"FARMER") {
  const passwordHash = await bcrypt.hash(password,12);
  const r = await db.collection("users").findOneAndUpdate(
    { email },
    { $set:{name,email,passwordHash,role,updatedAt:new Date()}, $setOnInsert:{createdAt:new Date(), onboardingCompleted: role === "ADMIN"} },
    { upsert:true, returnDocument:"after" }
  );
  if (!r) throw new Error(`Unable to seed ${email}`);
  return String(r._id);
}

async function main() {
  await client.connect();
  await db.collection("crops").createIndex({slug:1},{unique:true});
  await db.collection("users").createIndex({email:1},{unique:true});
  await db.collection("farmProfiles").createIndex({userId:1},{unique:true});
  await db.collection("recommendations").createIndex({userId:1,createdAt:-1});
  await db.collection("crops").bulkWrite((seedData as any[]).map(c=>({updateOne:{filter:{slug:c.slug},update:{$set:{...c,active:true,seededAt:new Date()}},upsert:true}})));

  await upsertUser("FarmCompass Administrator",process.env.SEED_ADMIN_EMAIL||"admin@farmcompass.ng",process.env.SEED_ADMIN_PASSWORD||"Admin123!","ADMIN");
  const farmerId = await upsertUser("Adebayo Ogunleye",process.env.SEED_FARMER_EMAIL||"farmer@farmcompass.ng",process.env.SEED_FARMER_PASSWORD||"Farmer123!","FARMER");
  const now = new Date();
  await db.collection("farmProfiles").updateOne(
    {userId:farmerId},
    {
      $set:{userId:farmerId,state:"Ogun",lga:"Obafemi Owode",farmSizeHa:1.2,soilType:"Sandy loam",pH:6.0,irrigation:"rainfed",farmingGoal:"food crop",plantingMonth:"April",notes:"Demo farmer-managed profile for local development.",updatedBy:"FARMER",updatedAt:now},
      $setOnInsert:{createdAt:now},
      $unset:{createdByAdminId:"",updatedByAdminId:"",verifiedAt:""}
    },
    {upsert:true}
  );

  console.log(`Seeded ${seedData.length} crop records.`);
  console.log("Demo admin: admin@farmcompass.ng / Admin123!");
  console.log("Demo farmer: farmer@farmcompass.ng / Farmer123!");
  await client.close();
}

main().catch(async e=>{console.error(e);await client.close();process.exit(1)});
