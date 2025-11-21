// dmCommands.js
import { SlashCommandBuilder, MessageFlags } from "discord.js";

export const dmCommands = [
  {
    data: new SlashCommandBuilder()
      .setName("livelli-e-statistiche")
      .setDescription("Ricevi in DM una spiegazione sui livelli e le statistiche"),
    async execute(interaction) {
      try {
        // Mando il DM
        await interaction.user.send(
          `📊 **Livelli e Statistiche**
          
- Ogni personaggio parte con 25 punti da distribuire.
- Le statistiche disponibili sono: Forza, Destrezza, Percezione, Intelligenza, Carisma.
- Ogni statistica può avere un valore da 1 a 10.
- I livelli si ottengono spendendo punti infamia o completando missioni.`
        );

        // Rispondo subito all'interazione
        await interaction.reply({
          content: "✅ Ti ho inviato le informazioni in DM!",
          flags: MessageFlags.Ephemeral
        });
      } catch (err) {
        await interaction.reply({
          content: "❌ Non sono riuscito a mandarti il DM (forse hai i DM chiusi).",
          flags: MessageFlags.Ephemeral
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
- Alcune abilità sono esclusive di certe razze.`
        );

        await interaction.reply({
          content: "✅ Ti ho inviato la guida in DM!",
          flags: MessageFlags.Ephemeral
        });
      } catch (err) {
        await interaction.reply({
          content: "❌ Non sono riuscito a mandarti il DM.",
          flags: MessageFlags.Ephemeral
        });
      }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName("economia")
      .setDescription("Ricevi in DM una spiegazione sull'economia del gioco"),
    async execute(interaction) {
      try {
        await interaction.user.send(
          `💰 **Economia del Gioco**
          
- La valuta principale sono i Souls.
- Puoi guadagnare Souls con il comando /daily o completando missioni.
- Puoi trasferire Souls con /pay.
- Gli admin possono modificare i tuoi Souls con /modifymoney.`
        );

        await interaction.reply({
          content: "✅ Ti ho inviato le informazioni sull'economia in DM!",
          flags: MessageFlags.Ephemeral
        });
      } catch (err) {
        await interaction.reply({
          content: "❌ Non sono riuscito a mandarti il DM.",
          flags: MessageFlags.Ephemeral
        });
      }
    },
  }
];
