import mongoose from "mongoose";

const { Schema, model } = mongoose;

// One document per "join event". A user rejoining creates a NEW document,
// but only the most recent join for a given (guildId, invitedUserId) is
// ever counted as "valid" — see inviteTracker.js for the enforcement logic.
const InviteSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    inviterId: { type: String, default: null, index: true }, // null = unknown/vanity
    invitedUserId: { type: String, required: true, index: true },
    inviteCode: { type: String, default: null },
    joinType: {
      type: String,
      enum: ["normal", "vanity", "unknown"],
      default: "normal"
    },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    isValid: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

InviteSchema.index({ guildId: 1, invitedUserId: 1, joinedAt: -1 });

export default model("Invite", InviteSchema);
