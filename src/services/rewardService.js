import Reward from "../database/models/Reward.js";
import RewardClaim from "../database/models/RewardClaim.js";
import { getValidInviteCount } from "./inviteTracker.js";

// ---------- Reward CRUD ----------

export async function createReward(guildId, name, requiredInvites) {
  return Reward.create({ guildId, name, requiredInvites, enabled: true });
}

export async function editRewardName(rewardId, name) {
  return Reward.findByIdAndUpdate(rewardId, { $set: { name } }, { new: true });
}

export async function editRewardRequiredInvites(rewardId, requiredInvites) {
  return Reward.findByIdAndUpdate(rewardId, { $set: { requiredInvites } }, { new: true });
}

export async function deleteReward(rewardId) {
  return Reward.findByIdAndDelete(rewardId);
}

export async function toggleReward(rewardId) {
  const reward = await Reward.findById(rewardId);
  if (!reward) return null;
  reward.enabled = !reward.enabled;
  await reward.save();
  return reward;
}

export async function listRewards(guildId, { onlyEnabled = false } = {}) {
  const filter = { guildId };
  if (onlyEnabled) filter.enabled = true;
  return Reward.find(filter).sort({ requiredInvites: 1 }).lean();
}

export async function getReward(rewardId) {
  return Reward.findById(rewardId).lean();
}

// ---------- Progress helpers (used by /invites image + /claim) ----------

/**
 * Given a user's valid invite count, finds the next enabled reward they have
 * not yet unlocked (lowest requiredInvites greater than their current count).
 * Returns null if every enabled reward has already been reached.
 */
export async function getNextReward(guildId, validInviteCount) {
  const rewards = await Reward.find({
    guildId,
    enabled: true,
    requiredInvites: { $gt: validInviteCount }
  })
    .sort({ requiredInvites: 1 })
    .limit(1)
    .lean();

  return rewards[0] ?? null;
}

/**
 * Finds every enabled reward the user currently qualifies for
 * (requiredInvites <= their count) that they have not already claimed
 * (accepted or pending). Used by /claim to know what's claimable right now.
 */
export async function getClaimableRewards(guildId, userId) {
  const validCount = await getValidInviteCount(guildId, userId);

  const eligibleRewards = await Reward.find({
    guildId,
    enabled: true,
    requiredInvites: { $lte: validCount }
  })
    .sort({ requiredInvites: 1 })
    .lean();

  if (eligibleRewards.length === 0) return { validCount, claimable: [] };

  const existingClaims = await RewardClaim.find({
    guildId,
    userId,
    rewardId: { $in: eligibleRewards.map((r) => r._id) },
    status: { $in: ["pending", "accepted"] }
  }).lean();

  const takenRewardIds = new Set(existingClaims.map((c) => String(c.rewardId)));
  const claimable = eligibleRewards.filter((r) => !takenRewardIds.has(String(r._id)));

  return { validCount, claimable };
}

// ---------- Claim lifecycle ----------

export async function createClaimRequest(guildId, userId, reward, validInvitesAtRequest) {
  return RewardClaim.create({
    guildId,
    userId,
    rewardId: reward._id,
    rewardName: reward.name,
    requiredInvitesSnapshot: reward.requiredInvites,
    validInvitesAtRequest,
    status: "pending"
  });
}

export async function getClaim(claimId) {
  return RewardClaim.findById(claimId);
}

export async function acceptClaim(claimId, resolverId) {
  const claim = await RewardClaim.findById(claimId);
  if (!claim || claim.status !== "pending") return null;

  claim.status = "accepted";
  claim.resolvedAt = new Date();
  claim.resolvedBy = resolverId;
  await claim.save();
  return claim;
}

export async function rejectClaim(claimId, resolverId, reason = null) {
  const claim = await RewardClaim.findById(claimId);
  if (!claim || claim.status !== "pending") return null;

  claim.status = "rejected";
  claim.resolvedAt = new Date();
  claim.resolvedBy = resolverId;
  claim.rejectionReason = reason;
  await claim.save();
  return claim;
}

export async function getPendingClaims(guildId, limit = 25) {
  return RewardClaim.find({ guildId, status: "pending" }).sort({ requestedAt: 1 }).limit(limit).lean();
}

export async function getClaimHistory(guildId, limit = 25) {
  return RewardClaim.find({ guildId, status: { $in: ["accepted", "rejected"] } })
    .sort({ resolvedAt: -1 })
    .limit(limit)
    .lean();
}

export default {
  createReward,
  editRewardName,
  editRewardRequiredInvites,
  deleteReward,
  toggleReward,
  listRewards,
  getReward,
  getNextReward,
  getClaimableRewards,
  createClaimRequest,
  getClaim,
  acceptClaim,
  rejectClaim,
  getPendingClaims,
  getClaimHistory
};
