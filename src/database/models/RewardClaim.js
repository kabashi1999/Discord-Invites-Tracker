import mongoose from "mongoose";

const { Schema, model } = mongoose;

const RewardClaimSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    rewardId: { type: Schema.Types.ObjectId, ref: "Reward", required: true },
    rewardName: { type: String, required: true }, // snapshot in case reward is edited/deleted later
    requiredInvitesSnapshot: { type: Number, required: true },
    validInvitesAtRequest: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true
    },
    requestedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
    rejectionReason: { type: String, default: null }
  },
  { timestamps: true }
);

RewardClaimSchema.index({ guildId: 1, userId: 1, rewardId: 1, status: 1 });

export default model("RewardClaim", RewardClaimSchema);
