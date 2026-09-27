import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";

export function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers, // privileged — must be enabled in the Dev Portal
      GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.GuildMember, Partials.User]
  });

  client.commands = new Collection(); // name -> command module
  client.cooldowns = new Collection();

  return client;
}

export default createClient;
