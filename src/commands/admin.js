import { SlashCommandBuilder } from "discord.js";
import { isAdminMember } from "../utils/permissions.js";
import { renderMainPanel } from "../handlers/adminPanel.js";

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("Open the invite tracker admin control panel");

export async function execute(interaction) {
  const allowed = await isAdminMember(interaction.member);

  if (!allowed) {
    await interaction.reply({
      content: "🚫 You don't have permission to use the admin panel.",
      ephemeral: true
    });
    return;
  }

  const view = renderMainPanel();
  await interaction.reply({ ...view, ephemeral: true });
}

export default { data, execute };
