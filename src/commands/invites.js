import { SlashCommandBuilder, AttachmentBuilder } from "discord.js";
import { getUserInvitesDoc, getValidInviteCount } from "../services/inviteTracker.js";
import { getNextReward } from "../services/rewardService.js";
import { generateInviteCard } from "../services/imageGenerator.js";

export const data = new SlashCommandBuilder()
  .setName("invites")
  .setDescription("Show a member's invite progress card")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Member to check (defaults to you)").setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser("user") ?? interaction.user;
  const guildId = interaction.guild.id;

  const [validCount, userDoc] = await Promise.all([
    getValidInviteCount(guildId, targetUser.id),
    getUserInvitesDoc(guildId, targetUser.id)
  ]);

  const nextReward = await getNextReward(guildId, validCount);

  let lastInvitedUsername = null;
  if (userDoc?.lastInvitedUserId) {
    const lastMember = await interaction.guild.members.fetch(userDoc.lastInvitedUserId).catch(() => null);
    lastInvitedUsername = lastMember?.displayName ?? `User ${userDoc.lastInvitedUserId}`;
  }

  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  const displayName = member?.displayName ?? targetUser.username;
  const avatarURL = targetUser.displayAvatarURL({ extension: "png", size: 256 });

  const buffer = await generateInviteCard({
    username: displayName,
    avatarURL,
    validInviteCount: validCount,
    nextReward: nextReward ? { name: nextReward.name, requiredInvites: nextReward.requiredInvites } : null,
    lastInvitedUsername
  });

  const attachment = new AttachmentBuilder(buffer, { name: "invites.png" });
  await interaction.editReply({ files: [attachment] });
}

export default { data, execute };
