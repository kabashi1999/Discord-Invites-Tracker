export async function handleCommand(interaction, client) {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`[CommandHandler] Error executing /${interaction.commandName}:`, err);
    const payload = { content: "⚠️ Something went wrong while running that command.", ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
}

export default { handleCommand };
