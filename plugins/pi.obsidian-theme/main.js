/**
 * Obsidian Theme — entry point.
 *
 * The theme itself is declarative: the host reads `contributes.themes` and
 * injects `themes/obsidian.css` when the user picks it, so nothing has to be
 * registered at runtime. The only runtime work is one command that opens the
 * info panel, so the user can reach the palette reference from the command
 * palette without hunting through Settings.
 */
const OPEN_COMMAND_ID = "obsidian-theme.open";

async function onLoad() {
  await pi.commands.register({
    id: OPEN_COMMAND_ID,
    title: "Obsidian Theme: Open info panel",
    keywords: ["obsidian", "theme", "dark", "黑曜石", "主题", "深色"],
    run: async () => {
      await pi.ui.openPanel();
    },
  });
}

async function onUnload() {
  await pi.commands.unregister(OPEN_COMMAND_ID);
}

module.exports = { onLoad, onUnload };
