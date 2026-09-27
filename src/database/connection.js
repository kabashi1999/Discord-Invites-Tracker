import mongoose from "mongoose";
import { config } from "../config.js";

mongoose.set("strictQuery", true);

export async function connectDatabase() {
  mongoose.connection.on("connected", () => {
    console.log("[MongoDB] Connected.");
  });

  mongoose.connection.on("error", (err) => {
    console.error("[MongoDB] Connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Disconnected. Mongoose will retry automatically on next operation.");
  });

  await mongoose.connect(config.mongoUri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 15000
  });

  return mongoose.connection;
}

export default connectDatabase;
