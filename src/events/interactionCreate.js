import { handleCommand } from "../handlers/commandHandler.js";
import { handleButton } from "../handlers/buttonHandler.js";
import { handleSelectMenu } from "../handlers/selectMenuHandler.js";
import { handleModalSubmit } from "../handlers/modalHandler.js";

export const name = "interactionCreate";
export const once = false;

export async function execute(interaction, client) {
  try {
    if (interaction.isChatInputCommand()) {
      return await handleCommand(interaction, client);
    }

    if (interaction.isButton()) {
      return await handleButton(interaction, client);
    }

    if (
      interaction.isStringSelectMenu() ||
      interaction.isUserSelectMenu() ||
      interaction.isChannelSelectMenu() ||
      interaction.isRoleSelectMenu()
    ) {
      return await handleSelectMenu(interaction, client);
    }

    if (interaction.isModalSubmit()) {
      return await handleModalSubmit(interaction, client);
    }
  } catch (err) {
    console.error("[interactionCreate] Unhandled error:", err);
    const payload = { content: "⚠️ Something went wrong handling that interaction.", ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else if (interaction.isRepliable()) {
        await interaction.reply(payload);
      }
    } catch {
      // Interaction may have already expired — nothing more we can do.
    }
  }
}

export default { name, once, execute };
