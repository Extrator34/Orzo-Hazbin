// askRace.js
import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";

export async function askRace({ channel, userId, characterName }) {
  const raceOptions = [
    "Peccatore", "Hellhound", "Succube", "Imp",
    "Bafometto", "Infestatore", "Winner",
    "Cherubino", "Angelo caduto"
  ];

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`select_race_${userId}_${characterName}`)
    .setPlaceholder("Scegli la razza del tuo personaggio")
    .addOptions(
      raceOptions.map(r => ({
        label: r,
        value: r.toLowerCase().replace(/ /g, "_")
      }))
    );

  const row = new ActionRowBuilder().addComponents(menu);

  await channel.send({
    content: `🧬 <@${userId}>, scegli la razza per **${characterName}**:`,
    components: [row]
  });
}
