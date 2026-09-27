import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "./client.js";
import { connectDatabase } from "./database/connection.js";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadCommands(client) {
  const commandsDir = path.join(__dirname, "commands");
  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".js"));

  for (const file of files) {
    const module = await import(pathToFileURL(path.join(commandsDir, file)).href);
    if (!module.data || !module.execute) {
      console.warn(`[Commands] Skipping ${file} — missing "data" or "execute" export.`);
      continue;
    }
    client.commands.set(module.data.name, module);
  }

  console.log(`[Commands] Loaded ${client.commands.size} command(s).`);
}

async function loadEvents(client) {
  const eventsDir = path.join(__dirname, "events");
  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith(".js"));

  for (const file of files) {
    const module = await import(pathToFileURL(path.join(eventsDir, file)).href);
    if (!module.name || !module.execute) {
      console.warn(`[Events] Skipping ${file} — missing "name" or "execute" export.`);
      continue;
    }

    const wrapped = (...args) => module.execute(...args, client);
    if (module.once) {
      client.once(module.name, wrapped);
    } else {
      client.on(module.name, wrapped);
    }
  }

  console.log(`[Events] Loaded ${files.length} event handler(s).`);
}

async function main() {
  console.log("[Bot] Connecting to MongoDB...");
  await connectDatabase();

  const client = createClient();
  await loadCommands(client);
  await loadEvents(client);

  process.on("unhandledRejection", (err) => {
    console.error("[Process] Unhandled promise rejection:", err);
  });

  process.on("SIGINT", () => {
    console.log("[Bot] Shutting down (SIGINT)...");
    client.destroy();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("[Bot] Shutting down (SIGTERM)...");
    client.destroy();
    process.exit(0);
  });

  await client.login(config.token);
}

main().catch((err) => {
  console.error("[Bot] Fatal startup error:", err);
  process.exit(1);
});
