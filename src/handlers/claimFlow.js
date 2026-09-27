import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import GuildConfig from "../database/models/GuildConfig.js";
import { createClaimRequest } from "../services/rewardService.js";
import { logEvent } from "../utils/logger.js";

/**
 * Creates a RewardClaim document and posts it to the configured Reward Requests
 * channel with Accept/Reject buttons. Returns a user-facing status message.
 * Shared by /claim (direct + select-menu paths).
 */
export async function sendClaimRequest(interaction, reward, validCount) {
  const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id }).lean();

  if (!guildConfig?.rewardRequestsChannelId) {
    return {
      ok: false,
      message:
        "This server hasn't configured a Reward Requests channel yet. Ask an admin to set one up with `/admin`."
    };
  }

  const channel = await interaction.guild.channels
    .fetch(guildConfig.rewardRequestsChannelId)
    .catch(() => null);

  if (!channel || !channel.isTextBased()) {
    return {
      ok: false,
      message: "The configured Reward Requests channel could not be found. Please notify an admin."
    };
  }

  const claim = await createClaimRequest(interaction.guild.id, interaction.user.id, reward, validCount);

  const embed = new EmbedBuilder()
    .setTitle("🎁 New Reward Claim Request")
    .addFields(
      { name: "Member", value: `${interaction.user} (${interaction.user.tag})`, inline: false },
      { name: "User ID", value: interaction.user.id, inline: true },
      { name: "Valid Invites", value: String(validCount), inline: true },
      { name: "Reward", value: reward.name, inline: false },
      { name: "Requested At", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
    )
    .setColor(0xfee75c)
    .setFooter({ text: `Claim ID: ${claim._id}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`claim:accept:${claim._id}`)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`claim:reject:${claim._id}`)
      .setLabel("Reject")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [row] });

  await logEvent(interaction.client, interaction.guild.id, {
    title: "Reward claim requested",
    description: `${interaction.user} requested **${reward.name}** (${validCount} valid invites).`,
    level: "info"
  });

  return { ok: true, message: `Your request for **${reward.name}** has been submitted for review!` };
}

export default { sendClaimRequest };
