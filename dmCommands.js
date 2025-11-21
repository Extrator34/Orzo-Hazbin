// dmCommands.js
import { SlashCommandBuilder } from "discord.js";

export const dmCommands = [
  {
    data: new SlashCommandBuilder()
      .setName("livelli-e-statistiche")
      .setDescription("Ricevi in DM una spiegazione sui livelli e le statistiche"),
    async execute(interaction) {
      try {
        await interaction.user.send(
          `📊 **Livelli e Statistiche**
          
- Ogni personaggio parte con 25 punti da distribuire.
- Le statistiche disponibili sono: Forza, Destrezza, Percezione, Intelligenza, Carisma.
- Ogni statistica può avere un valore da 1 a 10.
- I livelli si ottengono spendendo punti infamia o completando missioni.
          
⚠️ Ricorda: se hai problemi a distribuire i punti, usa il comando /help.`
        );

        await interaction.reply({
          content: "✅ Ti ho inviato le informazioni in DM!",
          ephemeral: true,
        });
      } catch (err) {
        await interaction.reply({
          content: "❌ Non sono riuscito a mandarti il DM (forse hai i DM chiusi).",
          ephemeral: true,
        });
      }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName("guida-abilità")
      .setDescription("Ricevi in DM una guida sulle abilità"),
    async execute(interaction) {
      try {
        await interaction.user.send(
          `✨ **Guida alle Abilità**
          
- Ogni razza ha abilità iniziali specifiche.
- Le abilità possono salire fino al livello 3.
- Alcune abilità sono esclusive di certe razze.
          
💡 Usa /addability (admin) per gestire manualmente le abilità.`
        );

        await interaction.reply({
          content: "✅ Ti ho inviato la guida in DM!",
          ephemeral: true,
        });
      } catch (err) {
        await interaction.reply({
          content: "❌ Non sono riuscito a mandarti il DM.",
          ephemeral: true,
        });
      }
    },
  },
];
