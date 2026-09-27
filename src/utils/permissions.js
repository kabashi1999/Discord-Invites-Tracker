import { PermissionsBitField } from "discord.js";
import GuildConfig from "../database/models/GuildConfig.js";

/**
 * Returns true if the given guild member is allowed to use the admin panel.
 * Rules:
 *  - Server owners and members with Administrator permission always pass.
 *  - Otherwise, the member must have at least one role listed in
 *    GuildConfig.adminRoleIds for that guild.
 *  - If no admin roles have been configured yet, only Administrators/owner pass
 *    (safe default so the panel isn't wide open before setup).
 */
export async function isAdminMember(member) {
  if (!member) return false;

  if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  if (member.guild?.ownerId === member.id) return true;

  const guildConfig = await GuildConfig.findOne({ guildId: member.guild.id }).lean();
  const adminRoleIds = guildConfig?.adminRoleIds ?? [];
  if (adminRoleIds.length === 0) return false;

  return member.roles.cache.some((role) => adminRoleIds.includes(role.id));
}

export default { isAdminMember };
