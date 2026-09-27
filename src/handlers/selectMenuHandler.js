import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from "discord.js";
import { isAdminMember } from "../utils/permissions.js";
import GuildConfig from "../database/models/GuildConfig.js";
import {
  renderRewardsPanel,
  renderRewardActions,
  renderManualInvitesPanel,
  renderResetInvitesPanel,
  renderResetConfirm,
  renderViewCountPanel,
  renderCountResult,
  renderViewListPanel,
  renderInvitedListResult,
  renderPendingPanel,
  renderHistoryPanel,
  renderSetRewardChannelPanel,
  renderSetLogsChannelPanel,
  renderSetAdminRolesPanel
} from "./adminPanel.js";
import { getReward, getClaimableRewards } from "../services/rewardService.js";
import { sendClaimRequest } from "./claimFlow.js";
import { logEvent } from "../utils/logger.js";

async function denyIfNotAdmin(interaction) {
  const allowed = await isAdminMember(interaction.member);
  if (!allowed) {
    await interaction.reply({ content: "🚫 You don't have permission to do that.", ephemeral: true });
    return true;
  }
  return false;
}

const SECTION_RENDERERS = {
  rewards: (interaction) => renderRewardsPanel(interaction.guild.id),
  manual_invites: () => renderManualInvitesPanel(),
  reset_invites: () => renderResetInvitesPanel(),
  view_count: () => renderViewCountPanel(),
  view_list: () => renderViewListPanel(),
  pending: (interaction) => renderPendingPanel(interaction.guild.id),
  history: (interaction) => renderHistoryPanel(interaction.guild.id),
  set_reward_channel: () => renderSetRewardChannelPanel(),
  set_logs_channel: () => renderSetLogsChannelPanel(),
  set_admin_roles: () => renderSetAdminRolesPanel()
};

export async function handleSelectMenu(interaction, client) {
  const id = interaction.customId;

  // ---------- /claim reward picker (not admin-gated — it's the user's own claim) ----------
  if (id === "claim:select") {
    const rewardId = interaction.values[0];
    const { validCount, claimable } = await getClaimableRewards(interaction.guild.id, interaction.user.id);
    const reward = claimable.find((r) => String(r._id) === rewardId);

    if (!reward) {
      return interaction.update({ content: "That reward is no longer available to claim.", components: [] });
    }

    const result = await sendClaimRequest(interaction, reward, validCount);
    return interaction.update({ content: result.message, components: [] });
  }

  // Everything else is admin-panel only.
  if (!id.startsWith("admin:")) return;
  if (await denyIfNotAdmin(interaction)) return;

  if (id === "admin:nav") {
    const section = interaction.values[0];
    const renderer = SECTION_RENDERERS[section];
    if (!renderer) return;
    const view = await renderer(interaction);
    return interaction.update(view);
  }

  if (id === "admin:reward:select") {
    const rewardId = interaction.values[0];
    const reward = await getReward(rewardId);
    if (!reward) {
      const view = await renderRewardsPanel(interaction.guild.id);
      return interaction.update(view);
    }
    return interaction.update(renderRewardActions(reward));
  }

  if (id === "admin:manual_invites:user") {
    const targetUserId = interaction.values[0];
    const modal = new ModalBuilder()
      .setCustomId(`modal:manual_invites:${targetUserId}`)
      .setTitle("Adjust Invites")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("amount")
            .setLabel("Amount (e.g. 5 or -3)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(10)
        )
      );
    return interaction.showModal(modal);
  }

  if (id === "admin:reset_invites:user") {
    const targetUserId = interaction.values[0];
    return interaction.update(renderResetConfirm(targetUserId));
  }

  if (id === "admin:view_count:user") {
    const targetUserId = interaction.values[0];
    const view = await renderCountResult(interaction.guild.id, targetUserId);
    return interaction.update(view);
  }

  if (id === "admin:view_list:user") {
    const targetUserId = interaction.values[0];
    const view = await renderInvitedListResult(interaction.guild.id, targetUserId);
    return interaction.update(view);
  }

  if (id === "admin:set_reward_channel") {
    const channelId = interaction.values[0];
    await GuildConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { $set: { rewardRequestsChannelId: channelId } },
      { upsert: true }
    );
    await logEvent(client, interaction.guild.id, {
      title: "Reward Requests channel updated",
      description: `Set to <#${channelId}> by ${interaction.user}.`,
      level: "info"
    });
    const embed = new EmbedBuilder()
      .setTitle("✅ Reward Requests Channel Set")
      .setColor(0x57f287)
      .setDescription(`Claim requests will now be posted in <#${channelId}>.`);
    return interaction.update({ embeds: [embed], components: [] });
  }

  if (id === "admin:set_logs_channel") {
    const channelId = interaction.values[0];
    await GuildConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { $set: { logsChannelId: channelId } },
      { upsert: true }
    );
    const embed = new EmbedBuilder()
      .setTitle("✅ Logs Channel Set")
      .setColor(0x57f287)
      .setDescription(`Actions will now be logged in <#${channelId}>.`);
    await interaction.update({ embeds: [embed], components: [] });
    return logEvent(client, interaction.guild.id, {
      title: "Logs channel updated",
      description: `Set to <#${channelId}> by ${interaction.user}.`,
      level: "info"
    });
  }

  if (id === "admin:set_admin_roles") {
    const roleIds = interaction.values;
    await GuildConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { $set: { adminRoleIds: roleIds } },
      { upsert: true }
    );
    await logEvent(client, interaction.guild.id, {
      title: "Admin roles updated",
      description: `Set to ${roleIds.map((r) => `<@&${r}>`).join(", ") || "(none)"} by ${interaction.user}.`,
      level: "info"
    });
    const embed = new EmbedBuilder()
      .setTitle("✅ Admin Roles Set")
      .setColor(0x57f287)
      .setDescription(
        roleIds.length
          ? `These roles can now use \`/admin\`: ${roleIds.map((r) => `<@&${r}>`).join(", ")}`
          : "No roles selected — only server Administrators/owner can use `/admin`."
      );
    return interaction.update({ embeds: [embed], components: [] });
  }
}

export default { handleSelectMenu };
