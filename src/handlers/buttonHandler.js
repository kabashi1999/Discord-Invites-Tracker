import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from "discord.js";
import { isAdminMember } from "../utils/permissions.js";
import {
  renderMainPanel,
  renderRewardsPanel,
  renderRewardActions,
  renderResetInvitesPanel,
  renderResetConfirm
} from "./adminPanel.js";
import { toggleReward, deleteReward, getReward, getClaim, acceptClaim, rejectClaim } from "../services/rewardService.js";
import { resetInvites } from "../services/inviteTracker.js";
import { logEvent } from "../utils/logger.js";

async function denyIfNotAdmin(interaction) {
  const allowed = await isAdminMember(interaction.member);
  if (!allowed) {
    await interaction.reply({ content: "🚫 You don't have permission to do that.", ephemeral: true });
    return true;
  }
  return false;
}

export async function handleButton(interaction, client) {
  const id = interaction.customId;

  // ---------- Claim accept / reject (posted in the Reward Requests channel) ----------
  if (id.startsWith("claim:accept:")) {
    if (await denyIfNotAdmin(interaction)) return;
    const claimId = id.split(":")[2];
    return handleClaimAccept(interaction, client, claimId);
  }

  if (id.startsWith("claim:reject:")) {
    if (await denyIfNotAdmin(interaction)) return;
    const claimId = id.split(":")[2];
    const modal = new ModalBuilder()
      .setCustomId(`modal:claim_reject:${claimId}`)
      .setTitle("Reject Reward Claim")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Reason (optional)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500)
        )
      );
    return interaction.showModal(modal);
  }

  // Everything else below is admin-panel only.
  if (!id.startsWith("admin:")) return;
  if (await denyIfNotAdmin(interaction)) return;

  if (id === "admin:back") {
    return interaction.update(renderMainPanel());
  }

  if (id === "admin:reward:add") {
    const modal = new ModalBuilder()
      .setCustomId("modal:reward_add")
      .setTitle("Add Reward")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Reward name")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("requiredInvites")
            .setLabel("Required invites (number)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(10)
        )
      );
    return interaction.showModal(modal);
  }

  if (id.startsWith("admin:reward:edit_name:")) {
    const rewardId = id.split(":")[3];
    const modal = new ModalBuilder()
      .setCustomId(`modal:reward_edit_name:${rewardId}`)
      .setTitle("Edit Reward Name")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("New name")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100)
        )
      );
    return interaction.showModal(modal);
  }

  if (id.startsWith("admin:reward:edit_count:")) {
    const rewardId = id.split(":")[3];
    const modal = new ModalBuilder()
      .setCustomId(`modal:reward_edit_count:${rewardId}`)
      .setTitle("Edit Required Invites")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("requiredInvites")
            .setLabel("New required invite count")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(10)
        )
      );
    return interaction.showModal(modal);
  }

  if (id.startsWith("admin:reward:toggle:")) {
    const rewardId = id.split(":")[3];
    const reward = await toggleReward(rewardId);
    await logEvent(client, interaction.guild.id, {
      title: "Reward toggled",
      description: `**${reward.name}** is now ${reward.enabled ? "enabled" : "disabled"} (by ${interaction.user}).`,
      level: "info"
    });
    return interaction.update(renderRewardActions(reward));
  }

  if (id.startsWith("admin:reward:delete:")) {
    const rewardId = id.split(":")[3];
    const reward = await getReward(rewardId);
    await deleteReward(rewardId);
    await logEvent(client, interaction.guild.id, {
      title: "Reward deleted",
      description: `**${reward?.name ?? rewardId}** was deleted by ${interaction.user}.`,
      level: "warning"
    });
    const view = await renderRewardsPanel(interaction.guild.id);
    return interaction.update(view);
  }

  if (id === "admin:reset_invites") {
    return interaction.update(renderResetInvitesPanel());
  }

  if (id.startsWith("admin:reset_invites:confirm:")) {
    const userId = id.split(":")[3];
    await resetInvites(interaction.guild.id, userId);
    await logEvent(client, interaction.guild.id, {
      title: "Member invites reset",
      description: `<@${userId}>'s invites were reset to 0 by ${interaction.user}.`,
      level: "warning"
    });

    const embed = new EmbedBuilder()
      .setTitle("✅ Invites Reset")
      .setColor(0x57f287)
      .setDescription(`<@${userId}>'s valid invite count has been reset to **0**.`);

    return interaction.update({ embeds: [embed], components: [] });
  }
}

async function handleClaimAccept(interaction, client, claimId) {
  const claim = await acceptClaim(claimId, interaction.user.id);

  if (!claim) {
    return interaction.reply({ content: "This claim was already resolved.", ephemeral: true });
  }

  await logEvent(client, interaction.guild.id, {
    title: "Reward claim accepted",
    description: `<@${claim.userId}>'s claim for **${claim.rewardName}** was accepted by ${interaction.user}.`,
    level: "success"
  });

  const user = await client.users.fetch(claim.userId).catch(() => null);
  if (user) {
    await user
      .send(`🎉 Your reward request for **${claim.rewardName}** in **${interaction.guild.name}** was accepted!`)
      .catch(() => {});
  }

  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = EmbedBuilder.from(originalEmbed)
    .setColor(0x57f287)
    .setTitle("✅ Reward Claim — Accepted")
    .addFields({ name: "Resolved By", value: `${interaction.user}` });

  return interaction.update({ embeds: [updatedEmbed], components: [] });
}

export default { handleButton };
