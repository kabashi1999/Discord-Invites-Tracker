import { cacheGuildInvites } from "../services/inviteTracker.js";

export const name = "ready";
export const once = true;

export async function execute(client) {
  console.log(`[Bot] Logged in as ${client.user.tag}`);

  const guilds = await client.guilds.fetch();
  for (const [, oauthGuild] of guilds) {
    const guild = await oauthGuild.fetch().catch(() => null);
    if (!guild) continue;
    await cacheGuildInvites(guild);
    console.log(`[InviteTracker] Cached invites for guild "${guild.name}" (${guild.id})`);
  }

  client.user.setActivity("/invites", { type: 3 }); // 3 = Watching
}

export default { name, once, execute };
