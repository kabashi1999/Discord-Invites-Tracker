import { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } from "discord.js";
import { getClaimableRewards } from "../services/rewardService.js";
import { sendClaimRequest } from "../handlers/claimFlow.js";

export const data = new SlashCommandBuilder()
  .setName("claim")
  .setDescription("Request a reward you've unlocked with your invites");

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const { validCount, claimable } = await getClaimableRewards(interaction.guild.id, interaction.user.id);

  if (claimable.length === 0) {
    await interaction.editReply({
      content: `You currently have **${validCount}** valid invites and no unclaimed rewards are available yet. Keep inviting!`
    });
    return;
  }

  // Exactly one claimable reward — submit immediately.
  if (claimable.length === 1) {
    const result = await sendClaimRequest(interaction, claimable[0], validCount);
    await interaction.editReply({ content: result.message });
    return;
  }

  // Multiple claimable rewards — let the member pick which one to request.
  const menu = new StringSelectMenuBuilder()
    .setCustomId("claim:select")
    .setPlaceholder("Choose a reward to claim")
    .addOptions(
      claimable.map((reward) => ({
        label: reward.name.slice(0, 100),
        description: `Requires ${reward.requiredInvites} invites`,
        value: String(reward._id)
      }))
    );

  const row = new ActionRowBuilder().addComponents(menu);

  await interaction.editReply({
    content: `You have **${validCount}** valid invites and qualify for multiple rewards. Pick one to request:`,
    components: [row]
  });
}

export default { data, execute };
