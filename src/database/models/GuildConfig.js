import mongoose from "mongoose";

const { Schema, model } = mongoose;

const GuildConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    rewardRequestsChannelId: { type: String, default: null },
    logsChannelId: { type: String, default: null },
    adminRoleIds: { type: [String], default: [] }
  },
  { timestamps: true }
);

export default model("GuildConfig", GuildConfigSchema);
