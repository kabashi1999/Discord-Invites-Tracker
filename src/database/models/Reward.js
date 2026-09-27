import mongoose from "mongoose";

const { Schema, model } = mongoose;

const RewardSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    requiredInvites: { type: Number, required: true, min: 0 },
    enabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

RewardSchema.index({ guildId: 1, requiredInvites: 1 });

export default model("Reward", RewardSchema);
