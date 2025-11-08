// askRace.js
import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";

export async function askRace({ interaction, characterName }) {
  const raceOptions = [
    "Peccatore", "Hellhound", "Succube", "Imp",
    "Bafometto", "Infestatore", "Winner",
    "Cherubino", "Angelo caduto"
  ];

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`select_race_${interaction.user.id}_${characterName}`)
    .setPlaceholder("Scegli la razza del tuo personaggio")
    .addOptions(
      raceOptions.map(r => ({
        label: r,
        value: r.toLowerCase().replace(/ /g, "_")
      }))
    );

  const row = new ActionRowBuilder().addComponents(menu);

  await interaction.followUp({
    content: `🧬 <@${interaction.user.id}>, scegli la razza per **${characterName}**:`,
    components: [row],
    ephemeral: true
  });
}
