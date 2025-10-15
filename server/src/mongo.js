import { MongoClient } from "mongodb";

let client = null;
let db = null;

export async function connectMongo() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  
  if (!mongoUri) {
    throw new Error("MongoDB URI not configured. Set MONGODB_URI or MONGO_URI environment variable.");
  }

  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    
    // Extract database name from URI or use default
    const dbName = process.env.MONGODB_DB_NAME || process.env.MONGO_DB_NAME || "stemchat";
    db = client.db(dbName);
    
    console.log("Đã kết nối MongoDB thành công");
    return db;
  } catch (error) {
    console.error("Lỗi kết nối MongoDB:", error);
    throw error;
  }
}

export function getDb() {
  return db;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("Đã đóng kết nối MongoDB");
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await closeMongo();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeMongo();
  process.exit(0);
});

