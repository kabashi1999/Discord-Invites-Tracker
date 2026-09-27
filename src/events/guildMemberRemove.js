import { handleMemberLeave } from "../services/inviteTracker.js";

export const name = "guildMemberRemove";
export const once = false;

export async function execute(member, client) {
  try {
    await handleMemberLeave(member, client);
  } catch (err) {
    console.error(`[guildMemberRemove] Failed to process leave for ${member.id} in ${member.guild.id}:`, err);
  }
}

export default { name, once, execute };
