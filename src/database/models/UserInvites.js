import mongoose from "mongoose";

const { Schema, model } = mongoose;

// Fast-access cache: one document per (guildId, userId).
// validInviteCount is the source of truth read by /invites, /leaderboard, and /claim.
// invitedUserIds is a de-duplicated list of everyone this user has ever
// validly invited (used by the admin panel's "view invited users" screen).
const UserInvitesSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    validInviteCount: { type: Number, default: 0 },
    manualAdjustment: { type: Number, default: 0 }, // sum of admin +/- adjustments
    invitedUserIds: { type: [String], default: [] },
    lastInvitedUserId: { type: String, default: null }
  },
  { timestamps: true }
);

UserInvitesSchema.index({ guildId: 1, userId: 1 }, { unique: true });
UserInvitesSchema.index({ guildId: 1, validInviteCount: -1 });

export default model("UserInvites", UserInvitesSchema);
