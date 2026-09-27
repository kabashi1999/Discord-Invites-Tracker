import { handleMemberJoin } from "../services/inviteTracker.js";

export const name = "guildMemberAdd";
export const once = false;

export async function execute(member, client) {
  try {
    await handleMemberJoin(member, client);
  } catch (err) {
    console.error(`[guildMemberAdd] Failed to process join for ${member.id} in ${member.guild.id}:`, err);
  }
}

export default { name, once, execute };
