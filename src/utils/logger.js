import { EmbedBuilder } from "discord.js";
import GuildConfig from "../database/models/GuildConfig.js";

const COLORS = {
  info: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  error: 0xed4245
};

/**
 * Logs an event both to the console and to the guild's configured logs channel (if set).
 * Never throws — logging failures must never break the calling flow.
 */
export async function logEvent(client, guildId, { title, description, fields = [], level = "info" }) {
  console.log(`[LOG][${guildId}] ${title} — ${description ?? ""}`);

  try {
    const guildConfig = await GuildConfig.findOne({ guildId }).lean();
    if (!guildConfig?.logsChannelId) return;

    const channel = await client.channels.fetch(guildConfig.logsChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(COLORS[level] ?? COLORS.info)
      .setTimestamp();

    if (description) embed.setDescription(description);
    if (fields.length) embed.addFields(fields);

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[Logger] Failed to send log message:", err);
  }
}

export default { logEvent };
