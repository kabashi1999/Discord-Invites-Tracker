import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType
} from "discord.js";
import GuildConfig from "../database/models/GuildConfig.js";
import { listRewards } from "../services/rewardService.js";
import {
  getValidInviteCount,
  getInvitedUsersList,
  getUserInvitesDoc
} from "../services/inviteTracker.js";
import { getPendingClaims, getClaimHistory } from "../services/rewardService.js";

const COLOR = 0x5865f2;

// ---------- Main navigation ----------

export function renderMainPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🛠️ Invite Tracker — Admin Panel")
    .setDescription("Choose a section below to manage.")
    .setColor(COLOR);

  const menu = new StringSelectMenuBuilder()
    .setCustomId("admin:nav")
    .setPlaceholder("Select a section...")
    .addOptions([
      { label: "Manage Rewards", value: "rewards", description: "Add / edit / delete / toggle rewards", emoji: "🎁" },
      { label: "Adjust Member Invites", value: "manual_invites", description: "Manually add or remove invites", emoji: "➕" },
      { label: "Reset Member Invites", value: "reset_invites", description: "Set a member's invites to zero", emoji: "🔄" },
      { label: "View Invite Count", value: "view_count", description: "Check a member's current count", emoji: "🔎" },
      { label: "View Invited Users", value: "view_list", description: "See who a member has invited", emoji: "📋" },
      { label: "Pending Reward Requests", value: "pending", description: "View unresolved claims", emoji: "⏳" },
      { label: "Claimed Rewards History", value: "history", description: "View resolved claims", emoji: "📜" },
      { label: "Set Reward Requests Channel", value: "set_reward_channel", description: "Where claim requests are posted", emoji: "📨" },
      { label: "Set Logs Channel", value: "set_logs_channel", description: "Where actions are logged", emoji: "🧾" },
      { label: "Set Admin Roles", value: "set_admin_roles", description: "Who can use this panel", emoji: "🔐" }
    ]);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function backRow(extraButtons = []) {
  const back = new ButtonBuilder().setCustomId("admin:back").setLabel("⬅ Back").setStyle(ButtonStyle.Secondary);
  return new ActionRowBuilder().addComponents(back, ...extraButtons);
}

// ---------- Rewards section ----------

export async function renderRewardsPanel(guildId) {
  const rewards = await listRewards(guildId);

  const embed = new EmbedBuilder()
    .setTitle("🎁 Manage Rewards")
    .setColor(COLOR)
    .setDescription(
      rewards.length
        ? rewards
            .map((r) => `${r.enabled ? "🟢" : "⚪"} **${r.name}** — ${r.requiredInvites} invites`)
            .join("\n")
        : "No rewards created yet."
    );

  const addButton = new ButtonBuilder()
    .setCustomId("admin:reward:add")
    .setLabel("➕ Add Reward")
    .setStyle(ButtonStyle.Success);

  const rows = [backRow([addButton])];

  if (rewards.length) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("admin:reward:select")
      .setPlaceholder("Select a reward to edit...")
      .addOptions(
        rewards.slice(0, 25).map((r) => ({
          label: r.name.slice(0, 100),
          description: `${r.requiredInvites} invites — ${r.enabled ? "enabled" : "disabled"}`,
          value: String(r._id)
        }))
      );
    rows.push(new ActionRowBuilder().addComponents(menu));
  }

  return { embeds: [embed], components: rows };
}

export function renderRewardActions(reward) {
  const embed = new EmbedBuilder()
    .setTitle(`🎁 ${reward.name}`)
    .setColor(COLOR)
    .addFields(
      { name: "Required Invites", value: String(reward.requiredInvites), inline: true },
      { name: "Status", value: reward.enabled ? "🟢 Enabled" : "⚪ Disabled", inline: true }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin:reward:edit_name:${reward._id}`)
      .setLabel("Edit Name")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`admin:reward:edit_count:${reward._id}`)
      .setLabel("Edit Required Invites")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`admin:reward:toggle:${reward._id}`)
      .setLabel(reward.enabled ? "Disable" : "Enable")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin:reward:delete:${reward._id}`)
      .setLabel("Delete")
      .setStyle(ButtonStyle.Danger)
  );

  const row2 = backRow();

  return { embeds: [embed], components: [row1, row2] };
}

// ---------- Manual invite adjustment ----------

export function renderManualInvitesPanel() {
  const embed = new EmbedBuilder()
    .setTitle("➕ Adjust Member Invites")
    .setColor(COLOR)
    .setDescription("Select a member below, then enter the amount to add or remove.");

  const userSelect = new UserSelectMenuBuilder()
    .setCustomId("admin:manual_invites:user")
    .setPlaceholder("Select a member...");

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(userSelect), backRow()]
  };
}

// ---------- Reset invites ----------

export function renderResetInvitesPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🔄 Reset Member Invites")
    .setColor(COLOR)
    .setDescription("Select a member to reset their valid invite count to zero.");

  const userSelect = new UserSelectMenuBuilder()
    .setCustomId("admin:reset_invites:user")
    .setPlaceholder("Select a member...");

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(userSelect), backRow()]
  };
}

export function renderResetConfirm(userId) {
  const embed = new EmbedBuilder()
    .setTitle("🔄 Confirm Reset")
    .setColor(0xed4245)
    .setDescription(`Are you sure you want to reset <@${userId}>'s invites to **0**? This cannot be undone.`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin:reset_invites:confirm:${userId}`)
      .setLabel("Yes, reset")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("admin:reset_invites").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// ---------- View count ----------

export function renderViewCountPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🔎 View Invite Count")
    .setColor(COLOR)
    .setDescription("Select a member to view their current valid invite count.");

  const userSelect = new UserSelectMenuBuilder()
    .setCustomId("admin:view_count:user")
    .setPlaceholder("Select a member...");

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(userSelect), backRow()]
  };
}

export async function renderCountResult(guildId, userId) {
  const [count, doc] = await Promise.all([
    getValidInviteCount(guildId, userId),
    getUserInvitesDoc(guildId, userId)
  ]);

  const embed = new EmbedBuilder()
    .setTitle("🔎 Invite Count")
    .setColor(COLOR)
    .addFields(
      { name: "Member", value: `<@${userId}>`, inline: true },
      { name: "Valid Invites", value: String(count), inline: true },
      { name: "Manual Adjustment Total", value: String(doc?.manualAdjustment ?? 0), inline: true }
    );

  return { embeds: [embed], components: [backRow()] };
}

// ---------- View invited users list ----------

export function renderViewListPanel() {
  const embed = new EmbedBuilder()
    .setTitle("📋 View Invited Users")
    .setColor(COLOR)
    .setDescription("Select a member to see the full list of users they've validly invited.");

  const userSelect = new UserSelectMenuBuilder()
    .setCustomId("admin:view_list:user")
    .setPlaceholder("Select a member...");

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(userSelect), backRow()]
  };
}

export async function renderInvitedListResult(guildId, userId) {
  const invitedIds = await getInvitedUsersList(guildId, userId);

  const embed = new EmbedBuilder()
    .setTitle("📋 Invited Users")
    .setColor(COLOR)
    .setDescription(
      invitedIds.length
        ? invitedIds
            .slice(0, 50)
            .map((id, i) => `${i + 1}. <@${id}>`)
            .join("\n")
        : "This member hasn't validly invited anyone yet."
    )
    .setFooter({ text: `Inviter: ${userId} — Total: ${invitedIds.length}` });

  return { embeds: [embed], components: [backRow()] };
}

// ---------- Pending requests / history ----------

export async function renderPendingPanel(guildId) {
  const pending = await getPendingClaims(guildId, 25);

  const embed = new EmbedBuilder()
    .setTitle("⏳ Pending Reward Requests")
    .setColor(COLOR)
    .setDescription(
      pending.length
        ? pending
            .map(
              (c) =>
                `<@${c.userId}> → **${c.rewardName}** (${c.validInvitesAtRequest} invites) — <t:${Math.floor(
                  new Date(c.requestedAt).getTime() / 1000
                )}:R>`
            )
            .join("\n")
        : "No pending requests. Resolve requests from the Reward Requests channel using the Accept/Reject buttons."
    );

  return { embeds: [embed], components: [backRow()] };
}

export async function renderHistoryPanel(guildId) {
  const history = await getClaimHistory(guildId, 25);

  const embed = new EmbedBuilder()
    .setTitle("📜 Claimed Rewards History")
    .setColor(COLOR)
    .setDescription(
      history.length
        ? history
            .map((c) => {
              const icon = c.status === "accepted" ? "✅" : "❌";
              return `${icon} <@${c.userId}> — **${c.rewardName}** — resolved by <@${c.resolvedBy}>`;
            })
            .join("\n")
        : "No resolved claims yet."
    );

  return { embeds: [embed], components: [backRow()] };
}

// ---------- Config: channels & roles ----------

export function renderSetRewardChannelPanel() {
  const embed = new EmbedBuilder()
    .setTitle("📨 Set Reward Requests Channel")
    .setColor(COLOR)
    .setDescription("Select the channel where new reward claim requests will be posted.");

  const select = new ChannelSelectMenuBuilder()
    .setCustomId("admin:set_reward_channel")
    .setPlaceholder("Select a channel...")
    .addChannelTypes(ChannelType.GuildText);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow()] };
}

export function renderSetLogsChannelPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🧾 Set Logs Channel")
    .setColor(COLOR)
    .setDescription("Select the channel where every tracked action will be logged.");

  const select = new ChannelSelectMenuBuilder()
    .setCustomId("admin:set_logs_channel")
    .setPlaceholder("Select a channel...")
    .addChannelTypes(ChannelType.GuildText);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow()] };
}

export function renderSetAdminRolesPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🔐 Set Admin Roles")
    .setColor(COLOR)
    .setDescription(
      "Select every role that should be able to use `/admin`. Server owners and Administrators always have access."
    );

  const select = new RoleSelectMenuBuilder()
    .setCustomId("admin:set_admin_roles")
    .setPlaceholder("Select role(s)...")
    .setMinValues(0)
    .setMaxValues(10);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow()] };
}

export async function getGuildConfigEmbedFooter(guildId) {
  const config = await GuildConfig.findOne({ guildId }).lean();
  return config;
}

export default {
  renderMainPanel,
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
};
