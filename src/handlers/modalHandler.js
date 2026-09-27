import { EmbedBuilder } from "discord.js";
import { isAdminMember } from "../utils/permissions.js";
import {
  createReward,
  editRewardName,
  editRewardRequiredInvites,
  getReward,
  rejectClaim
} from "../services/rewardService.js";
import { adjustInvitesManually } from "../services/inviteTracker.js";
import { renderRewardsPanel, renderRewardActions } from "./adminPanel.js";
import { logEvent } from "../utils/logger.js";

async function denyIfNotAdmin(interaction) {
  const allowed = await isAdminMember(interaction.member);
  if (!allowed) {
    await interaction.reply({ content: "🚫 You don't have permission to do that.", ephemeral: true });
    return true;
  }
  return false;
}

function parseIntStrict(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

export async function handleModalSubmit(interaction, client) {
  const id = interaction.customId;

  if (id.startsWith("modal:claim_reject:")) {
    if (await denyIfNotAdmin(interaction)) return;
    const claimId = id.split(":")[2];
    const reason = interaction.fields.getTextInputValue("reason") || null;

    const claim = await rejectClaim(claimId, interaction.user.id, reason);
    if (!claim) {
      return interaction.reply({ content: "This claim was already resolved.", ephemeral: true });
    }

    await logEvent(client, interaction.guild.id, {
      title: "Reward claim rejected",
      description: `<@${claim.userId}>'s claim for **${claim.rewardName}** was rejected by ${interaction.user}${
        reason ? ` — reason: ${reason}` : ""
      }.`,
      level: "warning"
    });

    const user = await client.users.fetch(claim.userId).catch(() => null);
    if (user) {
      await user
        .send(
          `❌ Your reward request for **${claim.rewardName}** in **${interaction.guild.name}** was rejected.${
            reason ? `\nReason: ${reason}` : ""
          }`
        )
        .catch(() => {});
    }

    const originalEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(0xed4245)
      .setTitle("❌ Reward Claim — Rejected")
      .addFields(
        { name: "Resolved By", value: `${interaction.user}` },
        { name: "Reason", value: reason ?? "No reason given" }
      );

    return interaction.update({ embeds: [updatedEmbed], components: [] });
  }

  // Everything else is admin-panel only.
  if (!id.startsWith("modal:")) return;
  if (await denyIfNotAdmin(interaction)) return;

  if (id === "modal:reward_add") {
    const name = interaction.fields.getTextInputValue("name").trim();
    const requiredInvitesRaw = interaction.fields.getTextInputValue("requiredInvites").trim();
    const requiredInvites = parseIntStrict(requiredInvitesRaw);

    if (requiredInvites === null || requiredInvites < 0) {
      return interaction.reply({
        content: "⚠️ Required invites must be a whole number (0 or greater).",
        ephemeral: true
      });
    }

    await createReward(interaction.guild.id, name, requiredInvites);
    await logEvent(client, interaction.guild.id, {
      title: "Reward created",
      description: `**${name}** (${requiredInvites} invites) created by ${interaction.user}.`,
      level: "success"
    });

    const view = await renderRewardsPanel(interaction.guild.id);
    return interaction.update(view);
  }

  if (id.startsWith("modal:reward_edit_name:")) {
    const rewardId = id.split(":")[2];
    const name = interaction.fields.getTextInputValue("name").trim();
    const reward = await editRewardName(rewardId, name);

    await logEvent(client, interaction.guild.id, {
      title: "Reward renamed",
      description: `Reward renamed to **${name}** by ${interaction.user}.`,
      level: "info"
    });

    return interaction.update(renderRewardActions(reward));
  }

  if (id.startsWith("modal:reward_edit_count:")) {
    const rewardId = id.split(":")[2];
    const raw = interaction.fields.getTextInputValue("requiredInvites").trim();
    const requiredInvites = parseIntStrict(raw);

    if (requiredInvites === null || requiredInvites < 0) {
      return interaction.reply({
        content: "⚠️ Required invites must be a whole number (0 or greater).",
        ephemeral: true
      });
    }

    const reward = await editRewardRequiredInvites(rewardId, requiredInvites);
    await logEvent(client, interaction.guild.id, {
      title: "Reward requirement updated",
      description: `**${reward.name}** now requires ${requiredInvites} invites (updated by ${interaction.user}).`,
      level: "info"
    });

    return interaction.update(renderRewardActions(reward));
  }

  if (id.startsWith("modal:manual_invites:")) {
    const targetUserId = id.split(":")[2];
    const raw = interaction.fields.getTextInputValue("amount").trim();
    const amount = parseIntStrict(raw);

    if (amount === null || amount === 0) {
      return interaction.reply({
        content: "⚠️ Amount must be a non-zero whole number (e.g. 5 or -3).",
        ephemeral: true
      });
    }

    const doc = await adjustInvitesManually(interaction.guild.id, targetUserId, amount);

    await logEvent(client, interaction.guild.id, {
      title: "Manual invite adjustment",
      description: `${interaction.user} ${amount > 0 ? "added" : "removed"} ${Math.abs(amount)} invite(s) ${
        amount > 0 ? "to" : "from"
      } <@${targetUserId}>. New total: ${doc.validInviteCount}.`,
      level: "info"
    });

    const embed = new EmbedBuilder()
      .setTitle("✅ Invites Adjusted")
      .setColor(0x57f287)
      .setDescription(`<@${targetUserId}>'s valid invites are now **${doc.validInviteCount}**.`);

    return interaction.update({ embeds: [embed], components: [] });
  }
}

export default { handleModalSubmit };
