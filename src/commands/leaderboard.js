import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getLeaderboard } from "../services/inviteTracker.js";

const PAGE_SIZE = 10;

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Show the top inviters in this server");

async function buildEmbed(interaction, entries, page, totalPages) {
  const lines = await Promise.all(
    entries.map(async (entry, idx) => {
      const rank = page * PAGE_SIZE + idx + 1;
      const member = await interaction.guild.members.fetch(entry.userId).catch(() => null);
      const name = member?.displayName ?? `<@${entry.userId}>`;
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
      return `${medal} **${name}** — ${entry.validInviteCount} invites`;
    })
  );

  return new EmbedBuilder()
    .setTitle("🏆 Invite Leaderboard")
    .setDescription(lines.length ? lines.join("\n") : "No tracked invites yet.")
    .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
    .setColor(0x5865f2)
    .setTimestamp();
}

export async function execute(interaction) {
  await interaction.deferReply();

  const all = await getLeaderboard(interaction.guild.id, 100);
  const totalPages = Math.max(Math.ceil(all.length / PAGE_SIZE), 1);
  const page = 0;
  const pageEntries = all.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const embed = await buildEmbed(interaction, pageEntries, page, totalPages);
  await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };
