import { Collection } from "discord.js";
import Invite from "../database/models/Invite.js";
import UserInvites from "../database/models/UserInvites.js";
import { logEvent } from "../utils/logger.js";

// In-memory mirror of every guild's live invites, keyed by guildId -> Collection<code, { uses, inviterId }>.
// This is rebuilt on ready() and kept in sync via inviteCreate/inviteDelete/guildMemberAdd.
const inviteCache = new Map();

// guildId -> current vanity URL use count (vanity invites have no code-based tracking).
const vanityCache = new Map();

function snapshotInvites(invites) {
  const snapshot = new Collection();
  for (const invite of invites.values()) {
    snapshot.set(invite.code, {
      uses: invite.uses ?? 0,
      inviterId: invite.inviter?.id ?? null
    });
  }
  return snapshot;
}

/**
 * Fetches and caches all current invites (+ vanity URL uses) for a guild.
 * Call this on ready() for every guild, and again after any invite create/delete
 * to keep the "before" snapshot accurate for the next join.
 */
export async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    inviteCache.set(guild.id, snapshotInvites(invites));
  } catch (err) {
    console.error(`[InviteTracker] Failed to fetch invites for guild ${guild.id}:`, err.message);
    inviteCache.set(guild.id, new Collection());
  }

  try {
    if (guild.features.includes("VANITY_URL")) {
      const vanityData = await guild.fetchVanityData();
      vanityCache.set(guild.id, vanityData?.uses ?? 0);
    }
  } catch {
    // Guild has no vanity URL or bot lacks permission — safe to ignore.
  }
}

export function updateInviteCacheOnCreate(invite) {
  const guildId = invite.guild?.id;
  if (!guildId) return;
  const cache = inviteCache.get(guildId) ?? new Collection();
  cache.set(invite.code, { uses: invite.uses ?? 0, inviterId: invite.inviter?.id ?? null });
  inviteCache.set(guildId, cache);
}

export function updateInviteCacheOnDelete(invite) {
  const guildId = invite.guild?.id;
  if (!guildId) return;
  const cache = inviteCache.get(guildId);
  if (cache) cache.delete(invite.code);
}

/**
 * Determines which invite was used for a new member join by diffing the
 * cached "before" snapshot against a freshly fetched "after" list.
 * Returns { code, inviterId, joinType } — inviterId/code may be null.
 */
async function detectUsedInvite(guild) {
  const before = inviteCache.get(guild.id) ?? new Collection();
  let after;

  try {
    after = await guild.invites.fetch();
  } catch (err) {
    console.error(`[InviteTracker] Could not fetch invites on join for guild ${guild.id}:`, err.message);
    return { code: null, inviterId: null, joinType: "unknown" };
  }

  const afterSnapshot = snapshotInvites(after);

  // Case 1: an existing invite's use count went up by (at least) 1.
  for (const [code, data] of afterSnapshot) {
    const beforeUses = before.get(code)?.uses ?? 0;
    if (data.uses > beforeUses) {
      inviteCache.set(guild.id, afterSnapshot);
      return { code, inviterId: data.inviterId, joinType: "normal" };
    }
  }

  // Case 2: an invite that existed before is now gone AND had exactly one use left
  // (single-use invite consumed on join, deleted automatically by Discord).
  for (const [code, data] of before) {
    if (!afterSnapshot.has(code)) {
      inviteCache.set(guild.id, afterSnapshot);
      return { code, inviterId: data.inviterId, joinType: "normal" };
    }
  }

  // Case 3: vanity URL use count increased.
  try {
    if (guild.features.includes("VANITY_URL")) {
      const vanityData = await guild.fetchVanityData();
      const beforeVanity = vanityCache.get(guild.id) ?? 0;
      const nowVanity = vanityData?.uses ?? 0;
      vanityCache.set(guild.id, nowVanity);
      if (nowVanity > beforeVanity) {
        inviteCache.set(guild.id, afterSnapshot);
        return { code: vanityData.code ?? "vanity", inviterId: null, joinType: "vanity" };
      }
    }
  } catch {
    // ignore
  }

  // Case 4: could not determine (permissions, invite tracking gap, etc.)
  inviteCache.set(guild.id, afterSnapshot);
  return { code: null, inviterId: null, joinType: "unknown" };
}

async function bumpUserInvites(guildId, inviterId, invitedUserId) {
  await UserInvites.findOneAndUpdate(
    { guildId, userId: inviterId },
    {
      $inc: { validInviteCount: 1 },
      $addToSet: { invitedUserIds: invitedUserId },
      $set: { lastInvitedUserId: invitedUserId }
    },
    { upsert: true, new: true }
  );
}

async function decrementUserInvites(guildId, inviterId, invitedUserId) {
  await UserInvites.findOneAndUpdate(
    { guildId, userId: inviterId },
    {
      $inc: { validInviteCount: -1 },
      $pull: { invitedUserIds: invitedUserId }
    },
    { upsert: true, new: true }
  );
}

/**
 * Main entry point, called from the guildMemberAdd event.
 * Handles first-time joins, rejoins (never double-counted), vanity joins,
 * and unknown-invite joins, then persists the full permanent history record.
 */
export async function handleMemberJoin(member, client) {
  const guild = member.guild;
  const { code, inviterId, joinType } = await detectUsedInvite(guild);

  // Has this user ever joined this guild before (rejoin detection)?
  const previousRecord = await Invite.findOne({
    guildId: guild.id,
    invitedUserId: member.id
  }).sort({ joinedAt: -1 });

  const isRejoin = Boolean(previousRecord);
  const isValid = !isRejoin && Boolean(inviterId);

  await Invite.create({
    guildId: guild.id,
    inviterId: inviterId ?? null,
    invitedUserId: member.id,
    inviteCode: code,
    joinType,
    joinedAt: new Date(),
    leftAt: null,
    isValid
  });

  if (isValid && inviterId) {
    await bumpUserInvites(guild.id, inviterId, member.id);
  }

  await logEvent(client, guild.id, {
    title: isRejoin ? "Member rejoined (not re-counted)" : "New member join tracked",
    description: `<@${member.id}> joined via ${
      joinType === "vanity" ? "the vanity URL" : joinType === "unknown" ? "an unresolved invite" : `code \`${code}\``
    }${inviterId ? ` (invited by <@${inviterId}>)` : ""}.`,
    level: isRejoin ? "warning" : "success"
  });

  return { code, inviterId, joinType, isRejoin, isValid };
}

/**
 * Called from guildMemberRemove. Finds the member's active (leftAt: null) join
 * record, closes it out, and — if it had been counted as valid — decrements
 * the inviter's live count.
 */
export async function handleMemberLeave(member, client) {
  const guild = member.guild;

  const activeRecord = await Invite.findOne({
    guildId: guild.id,
    invitedUserId: member.id,
    leftAt: null
  }).sort({ joinedAt: -1 });

  if (!activeRecord) return null;

  const wasValid = activeRecord.isValid;
  activeRecord.leftAt = new Date();
  activeRecord.isValid = false;
  await activeRecord.save();

  if (wasValid && activeRecord.inviterId) {
    await decrementUserInvites(guild.id, activeRecord.inviterId, member.id);
  }

  await logEvent(client, guild.id, {
    title: "Member left — invite adjusted",
    description: `<@${member.id}> left the server.${
      wasValid && activeRecord.inviterId
        ? ` <@${activeRecord.inviterId}>'s valid invite count was decremented.`
        : ""
    }`,
    level: "warning"
  });

  return activeRecord;
}

export async function getValidInviteCount(guildId, userId) {
  const doc = await UserInvites.findOne({ guildId, userId }).lean();
  return doc?.validInviteCount ?? 0;
}

export async function getUserInvitesDoc(guildId, userId) {
  return UserInvites.findOne({ guildId, userId }).lean();
}

export async function getLeaderboard(guildId, limit = 10) {
  return UserInvites.find({ guildId, validInviteCount: { $gt: 0 } })
    .sort({ validInviteCount: -1 })
    .limit(limit)
    .lean();
}

/**
 * Admin action: manually add or remove invites from a member.
 * amount may be negative. Never lets the count go below zero.
 */
export async function adjustInvitesManually(guildId, userId, amount) {
  const doc = await UserInvites.findOneAndUpdate(
    { guildId, userId },
    { $inc: { validInviteCount: amount, manualAdjustment: amount } },
    { upsert: true, new: true }
  );

  if (doc.validInviteCount < 0) {
    doc.validInviteCount = 0;
    await doc.save();
  }

  return doc;
}

export async function resetInvites(guildId, userId) {
  return UserInvites.findOneAndUpdate(
    { guildId, userId },
    { $set: { validInviteCount: 0, manualAdjustment: 0, invitedUserIds: [], lastInvitedUserId: null } },
    { upsert: true, new: true }
  );
}

export async function getInvitedUsersList(guildId, userId) {
  const doc = await UserInvites.findOne({ guildId, userId }).lean();
  return doc?.invitedUserIds ?? [];
}

export default {
  cacheGuildInvites,
  updateInviteCacheOnCreate,
  updateInviteCacheOnDelete,
  handleMemberJoin,
  handleMemberLeave,
  getValidInviteCount,
  getUserInvitesDoc,
  getLeaderboard,
  adjustInvitesManually,
  resetInvites,
  getInvitedUsersList
};
