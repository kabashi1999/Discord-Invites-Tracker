import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REST, Routes } from "discord.js";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const commandsDir = path.join(__dirname, "commands");
  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".js"));

  const commandsJSON = [];
  for (const file of files) {
    const module = await import(pathToFileURL(path.join(commandsDir, file)).href);
    if (!module.data) continue;
    commandsJSON.push(module.data.toJSON());
  }

  const rest = new REST({ version: "10" }).setToken(config.token);

  if (config.guildId) {
    console.log(`[Deploy] Registering ${commandsJSON.length} command(s) to guild ${config.guildId} (instant)...`);
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commandsJSON });
    console.log("[Deploy] Guild commands registered successfully.");
  } else {
    console.log(`[Deploy] Registering ${commandsJSON.length} command(s) globally (can take up to 1 hour)...`);
    await rest.put(Routes.applicationCommands(config.clientId), { body: commandsJSON });
    console.log("[Deploy] Global commands registered successfully.");
  }
}

main().catch((err) => {
  console.error("[Deploy] Failed to register commands:", err);
  process.exit(1);
});
