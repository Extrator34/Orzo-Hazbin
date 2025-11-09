// index.js
import http from "http";
import { Client, GatewayIntentBits, REST, Routes, Events, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder } from "discord.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { askRace } from "./askRace.js";
import { abilitaInfernali, abilitaCelestiali } from "./abilities.js";
import { raceAbilities } from "./raceAbilities.js";

dotenv.config();

/* ======================= FUNZIONE EMBED ======================= */
function createEmbed({ title, description, color = 0x0099ff }) {
  return { embeds: [{ title, description, color }] };
}

/* ======================= FUNZIONE STATS MENU ======================= */
function buildStatMenu(statName, userId, charName, remainingPoints, statsLeft) {
  // Calcola massimo assegnabile: non più di 10 e non più dei punti rimasti meno il minimo richiesto per le altre stats
  const maxAssignable = Math.min(10, remainingPoints - (statsLeft - 1));
  const options = [];
  for (let i = 1; i <= maxAssignable; i++) {
    options.push({ label: `${i}`, value: `${i}` });
  }

  return new StringSelectMenuBuilder()
    .setCustomId(`select_stat_${statName}_${userId}_${encodeURIComponent(charName)}`)
    .setPlaceholder(`Assegna punti a ${statName} (rimasti: ${remainingPoints})`)
    .addOptions(options);
}

/* ======================= WEB SERVER KEEP-ALIVE (Render) ======================= */
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot Discord attivo ✅");
});
server.listen(PORT, () => {
  console.log(`🌐 Server web fittizio in ascolto su porta ${PORT}`);
});

/* ======================= DEBUG ENV ======================= */
console.log("🔎 Variabili lette:");
console.log("DISCORD_TOKEN:", process.env.DISCORD_TOKEN ? "✔️ trovata" : "❌ mancante");
console.log("CLIENT_ID:", process.env.CLIENT_ID ? "✔️ trovata" : "❌ mancante");
console.log("MONGO_URI:", process.env.MONGO_URI ? "✔️ trovata" : "❌ mancante");

if (!process.env.MONGO_URI) {
  console.error("❌ ERRORE: Variabile MONGO_URI non trovata. Controlla le Environment su Render!");
  process.exit(1);
}

/* ======================= MONGODB ======================= */
try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connesso a MongoDB");
} catch (err) {
  console.error("❌ Errore connessione Mongo:", err);
  process.exit(1);
}

/* ======================= SCHEMA E MODEL ======================= */
const characterSchema = new mongoose.Schema({
  userId: String,
  name: String,
  image: { type: String },
  money: { type: Number, default: 500 },
  infamy: { type: Number, default: 0 },
  lastDaily: { type: Date, default: null },
  level: { type: Number, default: 1 },
  expTotale: { type: Number, default: 0 },
  expMostrata: { type: Number, default: 0 },
  lvlInnata: { type: Number, min: 1, max: 5, default: 1 },
  race: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  
  abilita: {
    type: [{
      nome: String,          // Nome abilità
      descrizione: String,   // Descrizione (opzionale)
      livello: { type: Number, min: 1, max: 3, default: 1 } // livello da 1 a 3
    }],
    default: []
  },

    stats: {
    forza:       { type: Number, min: 1, max: 10, default: 1 },
    destrezza:   { type: Number, min: 1, max: 10, default: 1 },
    percezione:  { type: Number, min: 1, max: 10, default: 1 },
    intelligenza:{ type: Number, min: 1, max: 10, default: 1 },
    carisma: { type: Number, min: 1, max: 10, default: 1 }
    }
});
const Character = mongoose.model("Character", characterSchema);

/* ======================= EXP TABLE ======================= */
const expTable = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
  [6, 7], [7, 8], [8, 9], [9, 10], [10, 11],
  [11, 12], [12, 13], [13, 14], [14, 15], [15, 16],
  [16, 17], [17, 18], [18, 19], [19, 20]
];
const maxExp = 5049000;

/* ======================= DISCORD CLIENT ======================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

/* ======================= PERMESSI ADMIN ======================= */
const ADMIN_ROLE_ID = "783454797445464076";

/* ======================= COMANDI SLASH ======================= */
const commands = [
  {
    name: "create",
    description: "Crea un nuovo personaggio",
    options: [
      { name: "name", type: 3, description: "Nome del personaggio", required: true },
      { name: "image", type: 11, description: "Immagine del personaggio", required: true },
    ],
  },
{
  name: "show",
  description: "Mostra un personaggio",
  options: [
    { name: "user", type: 6, description: "Utente proprietario del personaggio", required: true },
    { name: "from_name", type: 3, description: "Nome del personaggio", required: true, autocomplete: true }
  ]
},
{
  name: "list",
  description: "Mostra la lista dei personaggi",
  options: [
    { name: "user", type: 6, description: "Utente di cui vedere i personaggi", required: false }
  ]
},
  {
    name: "modifymoney",
    description: "(ADMIN ONLY) Aggiungi o rimuovi soldi ad un personaggio",
    options: [
      { name: "to_user", type: 6, description: "Utente proprietario del personaggio", required: true },
      { name: "to_name", type: 3, description: "Nome del personaggio", required: true, autocomplete: true },
      { name: "amount", type: 4, description: "Quantità di soldi da aggiungere", required: true },
    ],
  },
  {
    name: "pay",
    description: "Paga un altro personaggio",
    options: [
      { name: "from_name", type: 3, description: "Il tuo personaggio che paga", required: true, autocomplete: true },
      { name: "to_user", type: 6, description: "Utente che possiede il pg", required: true },
      { name: "to_name", type: 3, description: "Personaggio che riceve il denaro", required: true, autocomplete: true },
      { name: "amount", type: 4, description: "Quantità di soldi da trasferire", required: true },
    ],
  },
  {
    name: "rename",
    description: "Rinomina un tuo personaggio",
    options: [
      { name: "from_name", type: 3, description: "Il tuo personaggio da rinominare", required: true, autocomplete: true },
      { name: "name", type: 3, description: "Nuovo nome del personaggio", required: true },
    ],
  },
  {
  name: "modifyinnata",
  description: "(ADMIN ONLY) Modifica il livello innato di un personaggio",
  options: [
    { name: "to_user", type: 6, description: "Utente proprietario del personaggio", required: true },
    { name: "to_name", type: 3, description: "Nome del personaggio", required: true, autocomplete: true },
    { name: "amount", type: 4, description: "Valore da aggiungere o togliere (può essere negativo)", required: true }
  ]
},
  {
    name: "deletepg",
    description: "Elimina uno dei tuoi personaggi",
    options: [
      { type: 3, name: "from_name", description: "Nome del personaggio da eliminare", required: true, autocomplete: true }
    ]
  },
  {
  name: "help",
  description: "Mostra la lista dei comandi disponibili"
},
  {
  name: "changeimage",
  description: "Aggiorna l'immagine di un tuo personaggio",
  options: [
    { name: "from_name", type: 3, description: "Nome del personaggio", required: true, autocomplete: true },
    { name: "image", type: 11, description: "Nuova immagine del personaggio", required: true }
  ]
},
  {
  name: "daily",
  description: "Claim giornaliero: ottieni 100💰 per ogni tuo personaggio"
},
  {
  name: "levelup",
  description: "Spendi 1000 punti infamia per far salire di livello un tuo personaggio",
  options: [
    {
      name: "from_name",
      type: 3,
      description: "Nome del personaggio da livellare",
      required: true,
      autocomplete: true
    }
  ]
},
  {
  name: "modifyinfamy",
  description: "(ADMIN ONLY) Aggiungi o rimuovi punti infamia ad un personaggio",
  options: [
    { name: "to_user", type: 6, description: "Utente proprietario del personaggio", required: true },
    { name: "to_name", type: 3, description: "Nome del personaggio", required: true, autocomplete: true },
    { name: "amount", type: 4, description: "Quantità di punti infamia da aggiungere", required: true },
  ],
},
{
  name: "addability",
  description: "(ADMIN ONLY) Aggiungi o incrementa un'abilità a un personaggio",
  options: [
    { name: "to_user", type: 6, description: "Utente proprietario del personaggio", required: true },
    { name: "to_name", type: 3, description: "Nome del personaggio", required: true, autocomplete: true }
  ]
}
];

/* ======================= REGISTRAZIONE COMANDI ======================= */
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
try {
  console.log("🔄 Aggiornamento comandi slash (guild)...");
await rest.put(
  Routes.applicationCommands(process.env.CLIENT_ID),
  { body: commands }
);
  console.log("✅ Comandi slash registrati nella guild");
} catch (err) {
  console.error("❌ Errore registrazione comandi:", err);
}

/* ======================= EVENTI ======================= */
client.once(Events.ClientReady, () => {
  console.log(`🤖 Loggato come ${client.user.tag}`);
});



client.on("interactionCreate", async (interaction) => {
  try {

/* ---------- SELEZIONE RAZZA ---------- */
if (interaction.isStringSelectMenu() && interaction.customId.startsWith("select_race")) {
  const parts = interaction.customId.split("_");
  if (parts[0] !== "select" || parts[1] !== "race") return;

  const userId = parts[2];
  const charName = decodeURIComponent(parts.slice(3).join("_"));

  const selectedRace = interaction.values[0];
  const char = await Character.findOne({ userId, name: charName });

  if (!char) {
    await interaction.reply({
      content: "❌ Personaggio non trovato.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // Salva la razza
  char.race = selectedRace;

  // Aggiungi abilità iniziali
  const baseAbilities = raceAbilities[selectedRace] || [];
  if (!Array.isArray(char.abilita)) char.abilita = [];
  char.abilita.push(...baseAbilities);

  // Caso speciale: Imp
  if (selectedRace === "imp") {
    const choiceMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_imp_${interaction.user.id}_${encodeURIComponent(charName)}`)
      .setPlaceholder("Scegli un'abilità iniziale per Imp")
      .addOptions([
        { label: "Armi da Fuoco Leggere", value: "armi_leggere" },
        { label: "Armi Pesanti", value: "armi_pesanti" },
        { label: "Corpo a Corpo Urbano", value: "corpo_a_corpo" }
      ]);

    const row = new ActionRowBuilder().addComponents(choiceMenu);

    await interaction.reply({
      content: `✅ Razza selezionata: **Imp** per **${char.name}**.\nOra scegli un'abilità aggiuntiva:`,
      components: [row],
      flags: MessageFlags.Ephemeral
    });

    await char.save();
    return;
  }

  if (selectedRace === "peccatore") {
  const choiceMenu1 = new StringSelectMenuBuilder()
    .setCustomId(`select_peccatore1_${interaction.user.id}_${encodeURIComponent(charName)}`)
    .setPlaceholder("Scegli la prima abilità da Peccatore")
    .addOptions(
      abilitaInfernali.map(a => ({ label: a.nome, value: a.nome }))
    );

  const row1 = new ActionRowBuilder().addComponents(choiceMenu1);

  await interaction.reply({
    content: `✅ Razza selezionata: **Peccatore** per **${char.name}**.\nOra scegli la **prima abilità**:`,
    components: [row1],
    flags: MessageFlags.Ephemeral
  });

  await char.save();
  return;
}

// Caso speciale: Winner
if (selectedRace === "winner") {
  // Prima tendina (prime 25 abilità)
  const choiceMenu1 = new StringSelectMenuBuilder()
    .setCustomId(`select_winner1_${interaction.user.id}_${encodeURIComponent(charName)}`)
    .setPlaceholder("Scegli la prima abilità da Winner (1-25)")
    .addOptions(
      abilitaCelestiali.slice(0, 25).map(a => ({ label: a.nome, value: a.nome }))
    );

  // Seconda tendina (resto delle abilità, se presenti)
  const choiceMenu2 = new StringSelectMenuBuilder()
    .setCustomId(`select_winner1b_${interaction.user.id}_${encodeURIComponent(charName)}`)
    .setPlaceholder("Scegli la prima abilità da Winner (26+)")
    .addOptions(
      abilitaCelestiali.slice(25).map(a => ({ label: a.nome, value: a.nome }))
    );

  const rows = [new ActionRowBuilder().addComponents(choiceMenu1)];
  if (abilitaCelestiali.length > 25) {
    rows.push(new ActionRowBuilder().addComponents(choiceMenu2));
  }

  await interaction.reply({
    content: `✅ Razza selezionata: **Winner** per **${char.name}**.\nOra scegli la **prima abilità celestiale**:`,
    components: rows,
    flags: MessageFlags.Ephemeral
  });

  await char.save();
  return;
}

// Caso speciale: Angelo Caduto
if (selectedRace === "angelo_caduto") {
  // Filtra abilità celestiali escludendo "Volare"
  const abilitaCelestialiFiltrate = abilitaCelestiali.filter(a => a.nome !== "Volare");

  const choiceMenuCel = new StringSelectMenuBuilder()
    .setCustomId(`select_caduto1_${interaction.user.id}_${encodeURIComponent(charName)}`)
    .setPlaceholder("Scegli un'abilità celestiale (no Volare)")
    .addOptions(
      abilitaCelestialiFiltrate.slice(0, 25).map(a => ({ label: a.nome, value: a.nome }))
    );

  const rows = [new ActionRowBuilder().addComponents(choiceMenuCel)];
  if (abilitaCelestialiFiltrate.length > 25) {
    const choiceMenuCel2 = new StringSelectMenuBuilder()
      .setCustomId(`select_caduto1b_${interaction.user.id}_${encodeURIComponent(charName)}`)
      .setPlaceholder("Scegli un'abilità celestiale (extra)")
      .addOptions(
        abilitaCelestialiFiltrate.slice(25).map(a => ({ label: a.nome, value: a.nome }))
      );
    rows.push(new ActionRowBuilder().addComponents(choiceMenuCel2));
  }

  await interaction.reply({
    content: `✅ Razza selezionata: **Angelo Caduto** per **${char.name}**.\nOra scegli la **prima abilità celestiale** (Volare escluso):`,
    components: rows,
    flags: MessageFlags.Ephemeral
  });

  await char.save();
  return;
}

 await char.save();

// Conferma razza scelta
await interaction.update({
  content: `✅ Razza selezionata: **${selectedRace.replace(/_/g, " ")}** per **${char.name}**.\nAbilità iniziali assegnate.`,
  components: [],
});

// Avvia la distribuzione statistiche
if (!["imp", "peccatore", "winner", "angelo_caduto"].includes(selectedRace)) {
  // Avvia stats qui solo per razze normali
  const statMenu = buildStatMenu("forza", interaction.user.id, charName, 25, 5);
  const row = new ActionRowBuilder().addComponents(statMenu);
  await interaction.followUp({
    content: `📊 Ora distribuisci le statistiche per **${char.name}**.\nInizia con **Forza**:`,
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

return;

}

/* ---------- RAZZA IMP ---------- */
if (interaction.isStringSelectMenu() && interaction.customId.startsWith("select_imp")) {
  const parts = interaction.customId.split("_");
  const userId = parts[2];
  const charName = decodeURIComponent(parts.slice(3).join("_"));

  const selectedAbility = interaction.values[0];
  const char = await Character.findOne({ userId, name: charName });

  if (!char) {
    await interaction.reply({
      content: "❌ Personaggio non trovato.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const abilityMap = {
    armi_leggere: { nome: "Armi da Fuoco Leggere", descrizione: "Uso di pistole e revolver", livello: 1 },
    armi_pesanti: { nome: "Armi Pesanti", descrizione: "Uso di fucili e mitragliatrici infernali", livello: 1 },
    corpo_a_corpo: { nome: "Corpo a Corpo Urbano", descrizione: "Combattimento fisico ravvicinato", livello: 1 }
  };

  char.abilita.push(abilityMap[selectedAbility]);
  await char.save();

  await interaction.update({
    content: `✅ Abilità aggiuntiva selezionata per **${char.name}**: ${abilityMap[selectedAbility].nome}`,
    components: []
  });
  // Avvia la distribuzione statistiche
const statMenu = buildStatMenu("forza", interaction.user.id, charName, 25, 5);
const row = new ActionRowBuilder().addComponents(statMenu);

await interaction.followUp({
  content: `📊 Ora distribuisci le statistiche per **${char.name}**.\nInizia con **Forza**:`,
  components: [row],
  flags: MessageFlags.Ephemeral
});

}


    /* ---------- RAZZA PECCATORI ---------- */


if (interaction.isStringSelectMenu() && interaction.customId.startsWith("select_peccatore1")) {
  const parts = interaction.customId.split("_");
  const userId = parts[2];
  const charName = decodeURIComponent(parts.slice(3).join("_"));

  const selectedAbility1 = interaction.values[0];
  const char = await Character.findOne({ userId, name: charName });

  if (!char) {
    await interaction.reply({ content: "❌ Personaggio non trovato.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Salva la prima abilità
  const abilitaObj1 = abilitaInfernali.find(a => a.nome === selectedAbility1);
  if (abilitaObj1) char.abilita.push(abilitaObj1);
  await char.save();

  // Filtra la lista escludendo la prima abilità scelta
  const abilitaFiltrate = abilitaInfernali.filter(a => a.nome !== selectedAbility1);

  const choiceMenu2 = new StringSelectMenuBuilder()
    .setCustomId(`select_peccatore2_${interaction.user.id}_${encodeURIComponent(charName)}`)
    .setPlaceholder("Scegli la seconda abilità da Peccatore")
    .addOptions(
      abilitaFiltrate.map(a => ({ label: a.nome, value: a.nome }))
    );

  const row2 = new ActionRowBuilder().addComponents(choiceMenu2);

  await interaction.update({
    content: `✅ Prima abilità selezionata: **${selectedAbility1}**.\nOra scegli la **seconda abilità**:`,
    components: [row2]
  });
}

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("select_peccatore2")) {
  const parts = interaction.customId.split("_");
  const userId = parts[2];
  const charName = decodeURIComponent(parts.slice(3).join("_"));

  const selectedAbility2 = interaction.values[0];
  const char = await Character.findOne({ userId, name: charName });

  if (!char) {
    await interaction.reply({ content: "❌ Personaggio non trovato.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Salva la seconda abilità
  const abilitaObj2 = abilitaInfernali.find(a => a.nome === selectedAbility2);
  if (abilitaObj2) char.abilita.push(abilitaObj2);
  await char.save();

  await interaction.update({
    content: `✅ Abilità selezionate per **${char.name}**:\n1. ${char.abilita[0].nome}\n2. ${selectedAbility2}`,
    components: []
  });
      // Avvia la distribuzione statistiche
const statMenu = buildStatMenu("forza", interaction.user.id, charName, 25, 5);
const row = new ActionRowBuilder().addComponents(statMenu);

await interaction.followUp({
  content: `📊 Ora distribuisci le statistiche per **${char.name}**.\nInizia con **Forza**:`,
  components: [row],
  flags: MessageFlags.Ephemeral
});

}

      /* ---------- RAZZA WINNER ---------- */
    
if (interaction.isStringSelectMenu() && 
   (interaction.customId.startsWith("select_winner1") || interaction.customId.startsWith("select_winner1b"))) {
  
  const parts = interaction.customId.split("_");
  const userId = parts[2];
  const charName = decodeURIComponent(parts.slice(3).join("_"));

  const selectedAbility1 = interaction.values[0];
  const char = await Character.findOne({ userId, name: charName });

  if (!char) {
    await interaction.reply({ content: "❌ Personaggio non trovato.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Salva la prima abilità
  const abilitaObj1 = abilitaCelestiali.find(a => a.nome === selectedAbility1);
  if (abilitaObj1) char.abilita.push(abilitaObj1);
  await char.save();

  // Filtra la lista escludendo la prima scelta
  const abilitaFiltrate = abilitaCelestiali.filter(a => a.nome !== selectedAbility1);

  const choiceMenu2 = new StringSelectMenuBuilder()
    .setCustomId(`select_winner2_${interaction.user.id}_${encodeURIComponent(charName)}`)
    .setPlaceholder("Scegli la seconda abilità da Winner")
    .addOptions(
      abilitaFiltrate.slice(0, 25).map(a => ({ label: a.nome, value: a.nome }))
    );

  const rows = [new ActionRowBuilder().addComponents(choiceMenu2)];
  if (abilitaFiltrate.length > 25) {
    const choiceMenu2b = new StringSelectMenuBuilder()
      .setCustomId(`select_winner2b_${interaction.user.id}_${encodeURIComponent(charName)}`)
      .setPlaceholder("Scegli la seconda abilità da Winner (26+)")
      .addOptions(
        abilitaFiltrate.slice(25).map(a => ({ label: a.nome, value: a.nome }))
      );
    rows.push(new ActionRowBuilder().addComponents(choiceMenu2b));
  }

  await interaction.update({
    content: `✅ Prima abilità celestiale selezionata: **${selectedAbility1}**.\nOra scegli la **seconda abilità**:`,
    components: rows
  });
}
if (interaction.isStringSelectMenu() && 
   (interaction.customId.startsWith("select_winner2") || interaction.customId.startsWith("select_winner2b"))) {
  
  const parts = interaction.customId.split("_");
  const userId = parts[2];
  const charName = decodeURIComponent(parts.slice(3).join("_"));

  const selectedAbility2 = interaction.values[0];
  const char = await Character.findOne({ userId, name: charName });

  if (!char) {
    await interaction.reply({ content: "❌ Personaggio non trovato.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Salva la seconda abilità
  const abilitaObj2 = abilitaCelestiali.find(a => a.nome === selectedAbility2);
  if (abilitaObj2) char.abilita.push(abilitaObj2);
  await char.save();

  await interaction.update({
    content: `✅ Abilità celestiali selezionate per **${char.name}**:\n1. ${char.abilita[0].nome}\n2. ${selectedAbility2}`,
    components: []
  });
  // Avvia la distribuzione statistiche
const statMenu = buildStatMenu("forza", interaction.user.id, charName, 25, 5);
const row = new ActionRowBuilder().addComponents(statMenu);

await interaction.followUp({
  content: `📊 Ora distribuisci le statistiche per **${char.name}**.\nInizia con **Forza**:`,
  components: [row],
  flags: MessageFlags.Ephemeral
});

}

    
/*-------------------- RAZZA ANGELO CADUTO  --------------------*/
    if (interaction.isStringSelectMenu() && 
   (interaction.customId.startsWith("select_caduto1") || interaction.customId.startsWith("select_caduto1b"))) {
  
  const parts = interaction.customId.split("_");
  const userId = parts[2];
  const charName = decodeURIComponent(parts.slice(3).join("_"));

  const selectedCelAbility = interaction.values[0];
  const char = await Character.findOne({ userId, name: charName });

  if (!char) {
    await interaction.reply({ content: "❌ Personaggio non trovato.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Salva abilità celestiale
  const abilitaObjCel = abilitaCelestiali.find(a => a.nome === selectedCelAbility);
  if (abilitaObjCel) char.abilita.push(abilitaObjCel);
  await char.save();

  // Filtra abilità infernali escludendo le tre vietate
  const abilitaInfernaliFiltrate = abilitaInfernali.filter(a =>
    !["Armi da Fuoco Leggere", "Armi Pesanti", "Corpo a Corpo Urbano"].includes(a.nome)
  );

  const choiceMenuInf = new StringSelectMenuBuilder()
    .setCustomId(`select_caduto2_${interaction.user.id}_${encodeURIComponent(charName)}`)
    .setPlaceholder("Scegli un'abilità infernale (alcune escluse)")
    .addOptions(
      abilitaInfernaliFiltrate.slice(0, 25).map(a => ({ label: a.nome, value: a.nome }))
    );

  const rows = [new ActionRowBuilder().addComponents(choiceMenuInf)];
  if (abilitaInfernaliFiltrate.length > 25) {
    const choiceMenuInf2 = new StringSelectMenuBuilder()
      .setCustomId(`select_caduto2b_${interaction.user.id}_${encodeURIComponent(charName)}`)
      .setPlaceholder("Scegli un'abilità infernale (extra)")
      .addOptions(
        abilitaInfernaliFiltrate.slice(25).map(a => ({ label: a.nome, value: a.nome }))
      );
    rows.push(new ActionRowBuilder().addComponents(choiceMenuInf2));
  }

  await interaction.update({
    content: `✅ Abilità celestiale selezionata: **${selectedCelAbility}**.\nOra scegli la **seconda abilità infernale** (alcune escluse):`,
    components: rows
  });
}
if (interaction.isStringSelectMenu() && 
   (interaction.customId.startsWith("select_caduto2") || interaction.customId.startsWith("select_caduto2b"))) {
  
  const parts = interaction.customId.split("_");
  const userId = parts[2];
  const charName = decodeURIComponent(parts.slice(3).join("_"));

  const selectedInfAbility = interaction.values[0];
  const char = await Character.findOne({ userId, name: charName });

  if (!char) {
    await interaction.reply({ content: "❌ Personaggio non trovato.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Salva abilità infernale
  const abilitaObjInf = abilitaInfernali.find(a => a.nome === selectedInfAbility);
  if (abilitaObjInf) char.abilita.push(abilitaObjInf);
  await char.save();

  await interaction.update({
    content: `✅ Abilità selezionate per **${char.name}**:\n1. ${char.abilita[0].nome}\n2. ${selectedInfAbility}`,
    components: []
  });

  // Avvia la distribuzione statistiche SOLO se non già avviata
  if (!char.statsAssigned) {
    char.statsAssigned = true;
    await char.save();

    const statMenu = buildStatMenu("forza", interaction.user.id, charName, 25, 5);
    const row = new ActionRowBuilder().addComponents(statMenu);

    await interaction.followUp({
      content: `📊 Ora distribuisci le statistiche per **${char.name}**.\nInizia con **Forza**:`,
      components: [row],
      flags: MessageFlags.Ephemeral
    });
  }
}


// Definisci una costante globale all'inizio del file
const TOTAL_STAT_POINTS = 25;



    


/* ======================= SEZIONE ABILITà ======================= */
if (interaction.isChatInputCommand() && interaction.commandName === "addability") {
  // Controllo permessi admin
  if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
    await interaction.reply({ content: "❌ Non hai i permessi per usare questo comando.", flags: MessageFlags.Ephemeral });
    return;
  }

  const toUser = interaction.options.getUser("to_user");
  const toName = interaction.options.getString("to_name");

  const char = await Character.findOne({ userId: toUser.id, name: toName });
  if (!char) {
    await interaction.reply({ content: "❌ Personaggio non trovato.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Costruisci lista abilità (unisci infernali + celestiali)
  const allAbilities = [...abilitaInfernali, ...abilitaCelestiali];

  // Spezza in blocchi da max 25
  const rows = [];
  for (let i = 0; i < allAbilities.length; i += 25) {
    const chunk = allAbilities.slice(i, i + 25);
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`select_addability_${interaction.user.id}_${encodeURIComponent(char.name)}_${i}`)
      .setPlaceholder(`Scegli abilità (${i + 1}-${i + chunk.length})`)
      .addOptions(chunk.map(a => ({ label: a.nome, value: a.nome })));

    rows.push(new ActionRowBuilder().addComponents(menu));
  }

  await interaction.reply({
    content: `📜 Seleziona un'abilità da aggiungere o incrementare per **${char.name}**:`,
    components: rows,
    flags: MessageFlags.Ephemeral
  });
}


    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("select_addability")) {
  const parts = interaction.customId.split("_");
  const userId = parts[2];
  const charName = decodeURIComponent(parts[3]);

  const selectedAbility = interaction.values[0];
  const char = await Character.findOne({ userId, name: charName });
  if (!char) {
    await interaction.reply({ content: "❌ Personaggio non trovato.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Cerca abilità nella lista
  const abilitaObj = [...abilitaInfernali, ...abilitaCelestiali].find(a => a.nome === selectedAbility);
  if (!abilitaObj) {
    await interaction.reply({ content: "❌ Abilità non trovata.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Controlla se già presente
  const existing = char.abilita.find(a => a.nome === selectedAbility);

if (existing) {
  if (existing.livello < 3) {
    existing.livello += 1;
    await char.save();

    // aggiorna il messaggio originale
    await interaction.update({
      content: `✅ Abilità **${selectedAbility}** di **${char.name}** incrementata a livello ${existing.livello}.`,
      components: []
    });

    // opzionale: messaggio extra
    await interaction.followUp({
      content: `📜 Log: abilità incrementata`,
      flags: MessageFlags.Ephemeral
    });

  } else {
    await interaction.update({
      content: `⚠️ Abilità **${selectedAbility}** di **${char.name}** è già al livello massimo (3).`,
      components: []
    });
  }
} else {
  char.abilita.push({
    nome: abilitaObj.nome,
    descrizione: abilitaObj.descrizione || "",
    livello: 1
  });
  await char.save();

  await interaction.update({
    content: `✅ Abilità **${selectedAbility}** aggiunta a **${char.name}** (livello 1).`,
    components: []
  });

  // opzionale: messaggio extra
  await interaction.followUp({
    content: `📜 Log: nuova abilità aggiunta`,
    flags: MessageFlags.Ephemeral
  });
}
}




    
    

/* ======================= SEZIONE STATS ======================= */
if (interaction.isStringSelectMenu() && interaction.customId.startsWith("select_stat_forza")) {
  const parts = interaction.customId.split("_");
  const userId = parts[3];
  const charName = decodeURIComponent(parts.slice(4).join("_"));
  const forza = parseInt(interaction.values[0]);

  const char = await Character.findOne({ userId, name: charName });
  if (!char) return;

  char.stats.forza = forza;
  await char.save();

  const remaining = TOTAL_STAT_POINTS - forza;
  const menuDestrezza = buildStatMenu("destrezza", userId, charName, remaining, 4);
  const row = new ActionRowBuilder().addComponents(menuDestrezza);

  await interaction.update({
    content: `✅ Forza assegnata: ${forza}\nOra scegli **Destrezza** (punti rimasti: ${remaining})`,
    components: [row]
  });
}

if (interaction.isStringSelectMenu() && interaction.customId.startsWith("select_stat_destrezza")) {
  const parts = interaction.customId.split("_");
  const userId = parts[3];
  const charName = decodeURIComponent(parts.slice(4).join("_"));
  const destrezza = parseInt(interaction.values[0]);

  const char = await Character.findOne({ userId, name: charName });
  if (!char) return;

  char.stats.destrezza = destrezza;
  await char.save();

  const used = char.stats.forza + destrezza;
  const remaining = TOTAL_STAT_POINTS - used;
  const menuPercezione = buildStatMenu("percezione", userId, charName, remaining, 3);
  const row = new ActionRowBuilder().addComponents(menuPercezione);

  await interaction.update({
    content: `✅ Destrezza assegnata: ${destrezza}\nOra scegli **Percezione** (punti rimasti: ${remaining})`,
    components: [row]
  });
}

if (interaction.isStringSelectMenu() && interaction.customId.startsWith("select_stat_percezione")) {
  const parts = interaction.customId.split("_");
  const userId = parts[3];
  const charName = decodeURIComponent(parts.slice(4).join("_"));
  const percezione = parseInt(interaction.values[0]);

  const char = await Character.findOne({ userId, name: charName });
  if (!char) return;

  char.stats.percezione = percezione;
  await char.save();

  const used = char.stats.forza + char.stats.destrezza + percezione;
  const remaining = TOTAL_STAT_POINTS - used;
  const menuIntelligenza = buildStatMenu("intelligenza", userId, charName, remaining, 2);
  const row = new ActionRowBuilder().addComponents(menuIntelligenza);

  await interaction.update({
    content: `✅ Percezione assegnata: ${percezione}\nOra scegli **Intelligenza** (punti rimasti: ${remaining})`,
    components: [row]
  });
}

if (interaction.isStringSelectMenu() && interaction.customId.startsWith("select_stat_intelligenza")) {
  const parts = interaction.customId.split("_");
  const userId = parts[3];
  const charName = decodeURIComponent(parts.slice(4).join("_"));
  const intelligenza = parseInt(interaction.values[0]);

  const char = await Character.findOne({ userId, name: charName });
  if (!char) return;

  char.stats.intelligenza = intelligenza;
  await char.save();

  const used = char.stats.forza + char.stats.destrezza + char.stats.percezione + intelligenza;
  const remaining = TOTAL_STAT_POINTS - used;
  const menuCarisma = buildStatMenu("carisma", userId, charName, remaining, 1);
  const row = new ActionRowBuilder().addComponents(menuCarisma);

  await interaction.update({
    content: `✅ Intelligenza assegnata: ${intelligenza}\nOra scegli **Carisma** (punti rimasti: ${remaining})`,
    components: [row]
  });
}

if (interaction.isStringSelectMenu() && interaction.customId.startsWith("select_stat_carisma")) {
  const parts = interaction.customId.split("_");
  const userId = parts[3];
  const charName = decodeURIComponent(parts.slice(4).join("_"));
  const carisma = parseInt(interaction.values[0]);

  const char = await Character.findOne({ userId, name: charName });
  if (!char) return;

  char.stats.carisma = carisma;
  await char.save();

  const totale = char.stats.forza + char.stats.destrezza + char.stats.percezione + char.stats.intelligenza + carisma;

  await interaction.update({
    content: `✅ Statistiche finali per **${char.name}**:\n
    Forza: ${char.stats.forza}
    Destrezza: ${char.stats.destrezza}
    Percezione: ${char.stats.percezione}
    Intelligenza: ${char.stats.intelligenza}
    Carisma: ${char.stats.carisma}
    Totale: ${totale}/${TOTAL_STAT_POINTS}`,
    components: []
  });
}

   
    


  /* ---------- Autocomplete ---------- */
if (interaction.isAutocomplete()) {
  const focused = interaction.options.getFocused(true);
  let choices = [];

  // Helper: recupera l'userId target (selezionato in opzione "user") oppure il chiamante
  const targetUserId =
    interaction.options.get("user")?.value // ID dell'utente selezionato (anche se non risolto)
    || interaction.user.id;                // fallback: l'utente che esegue

  if (focused.name === "from_name") {
    const query = (focused.value || "").toLowerCase();
    const chars = await Character.find({ userId: targetUserId }).limit(100);
    choices = chars
      .filter(c => c.name.toLowerCase().includes(query))
      .map(c => ({ name: c.name, value: c.name }));
  }

  if (focused.name === "to_name") {
    // Per to_name continuiamo a leggere l'utente dalla relativa opzione "to_user"
    const toUserId = interaction.options.get("to_user")?.value;
    const baseUserId = toUserId || interaction.user.id;
    const query = (focused.value || "").toLowerCase();
    const chars = await Character.find({ userId: baseUserId }).limit(100);
    choices = chars
      .filter(c => c.name.toLowerCase().includes(query))
      .map(c => ({ name: c.name, value: c.name }));
  }

  // Risposta (max 25 elementi) o "Nessun risultato" se vuota
  await interaction.respond(
    choices.length ? choices.slice(0, 25) : [{ name: "Nessun risultato", value: "none" }]
  );
  return;
}


    if (!interaction.isChatInputCommand()) return;

    /* ---------- CREATE ---------- */
if (interaction.commandName === "create") {
await interaction.deferReply();
  
  const name = interaction.options.getString("name");
  const image = interaction.options.getAttachment("image");

  if (!image || !image.contentType?.startsWith("image/")) {
    await interaction.editReply(createEmbed({
      title: "❌ Errore",
      description: "Devi caricare un file immagine valido (jpg, png, ecc).",
      color: 0xff0000
    }));
    return;
  }

  // ID del canale dove caricare l'immagine (es. #galleria-pg)
  const mediaChannelId = "778383958135930924"; // ← sostituisci con l'ID reale
  const mediaChannel = client.channels.cache.get(mediaChannelId);

  if (!mediaChannel || !mediaChannel.isTextBased()) {
    await interaction.editReply(createEmbed({
      title: "❌ Errore",
      description: "Il canale media non è accessibile o non è testuale.",
      color: 0xff0000
    }));
    return;
  }

  // Invia l'immagine nel canale media
  let uploadedMessage;
  try {
    uploadedMessage = await mediaChannel.send({
      content: `📸 Immagine per il personaggio **${name}** di <@${interaction.user.id}>`,
      files: [image]
    });
  } catch (err) {
    console.error("Errore upload immagine:", err);
    await interaction.editReply(createEmbed({
      title: "❌ Errore",
      description: "Non sono riuscito a caricare l'immagine nel canale media.",
      color: 0xff0000
    }));
    return;
  }

  const permanentUrl = uploadedMessage.attachments.first()?.url;
  if (!permanentUrl) {
    await interaction.editReply(createEmbed({
      title: "❌ Errore",
      description: "Non sono riuscito a ottenere il link permanente dell'immagine.",
      color: 0xff0000
    }));
    return;
  }

// Crea il personaggio con il link permanente
const newChar = new Character({
  userId: interaction.user.id,
  name,
  image: permanentUrl
});
await newChar.save();

// Risposta iniziale
await interaction.editReply({
  embeds: [{
    title: `✅ Personaggio creato: ${name}`,
    description: `Creato da <@${interaction.user.id}>`,
    image: { url: permanentUrl },
    color: 0x00ff99
  }]
});

// Chiedi la razza nel canale dove è stato eseguito il comando
await askRace({ interaction, characterName: name });
  return;
}


    /* ---------- LIST ---------- */
   if (interaction.commandName === "list") {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser("user") || interaction.user;

  const chars = await Character.find({ userId: targetUser.id });
 
      if (!chars.length) {
        await interaction.editReply(createEmbed({
          title: "❌ Nessun personaggio",
          description: targetUser.id === interaction.user.id
            ? "Non hai ancora personaggi."
            : `L'utente ${targetUser.username} non ha personaggi.`,
          color: 0xff0000
        }));
        return;
  }

  const list = chars
    .map((c) => {
      const entry = [...expTable].reverse().find(([expReq]) => c.expTotale >= expReq);
      const livello = entry ? entry[1] : 1;


      return `- ${c.name}
  Livello: ${livello}
  Punti infamia: ${c.infamy}😈
  Soldi: ${c.money}💰
  
  -----------------------------`;
    })
    .join("\n");

 await interaction.editReply(createEmbed({
        title: targetUser.id === interaction.user.id
          ? "📜 I tuoi personaggi"
          : `📜 Personaggi di ${targetUser.username}`,
        description: list,
        color: 0x0099ff
      }));
      return;
}


    /* ---------- MODIFYMONEY ---------- */
    if (interaction.commandName === "modifymoney") {
      await interaction.deferReply();
      if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
        await interaction.editReply(createEmbed({
      title: "⛔ Permesso negato",
      description: "Non hai il permesso per usare questo comando.",
      color: 0xff0000
    }));
    return;
      }
      const user = interaction.options.getUser("to_user");
      const name = interaction.options.getString("to_name");
      const amount = interaction.options.getInteger("amount");

      const character = await Character.findOne({ userId: user.id, name });
      if (!character) {
        await interaction.editReply(createEmbed({
      title: "❌ Personaggio non trovato",
      description: `**${name}** non trovato per ${user.username}.`,
      color: 0xff0000
    }));
    return;
      }

      character.money += amount;
      await character.save();

      await interaction.editReply(createEmbed({
    title: "💰 Modifica denaro",
    description: `Aggiunti **${amount}** soldi a **${character.name}** di ${user.username}.\nTotale: ${character.money}💰`,
    color: 0x00ff99
  }));
  return;
    }

    /* ---------- PAY ---------- */
    if (interaction.commandName === "pay") {
      await interaction.deferReply();
      const fromName = interaction.options.getString("from_name");
      const toUser = interaction.options.getUser("to_user");
      const toName = interaction.options.getString("to_name");
      const amount = interaction.options.getInteger("amount");

      if (amount <= 0) {
        await interaction.editReply(createEmbed({
      title: "❌ Importo non valido",
      description: "L'importo deve essere un numero positivo maggiore di zero.",
      color: 0xff0000
    }));
    return;
      }

      const fromChar = await Character.findOne({ userId: interaction.user.id, name: fromName });
      if (!fromChar) {
        await interaction.editReply(createEmbed({
      title: "❌ Personaggio non trovato",
      description: `Non hai nessun personaggio chiamato **${fromName}**.`,
      color: 0xff0000
    }));
    return;
      }

      if (fromChar.money < amount) {
       await interaction.editReply(createEmbed({
      title: "❌ Fondi insufficienti",
      description: `**${fromChar.name}** non ha abbastanza soldi (ha ${fromChar.money}💰).`,
      color: 0xff0000
    }));
    return;
      }

      const toChar = await Character.findOne({ userId: toUser.id, name: toName });
      if (!toChar) {
        await interaction.editReply(createEmbed({
      title: "❌ Personaggio non trovato",
      description: `**${toName}** non è stato trovato per ${toUser.username}.`,
      color: 0xff0000
    }));
    return;
      }

      fromChar.money -= amount;
      toChar.money += amount;
      await fromChar.save();
      await toChar.save();

      await interaction.editReply(createEmbed({
    title: "✅ Pagamento effettuato",
    description: `**${fromChar.name}** ha pagato **${amount}💰** a **${toChar.name}** (${toUser.username}).\n` +
                 `Saldo aggiornato:\n` +
                 `• ${fromChar.name} → ${fromChar.money}💰\n` +
                 `• ${toChar.name} → ${toChar.money}💰`,
    color: 0x00ff99
  }));
  return;
    }

    /* ---------- RENAME ---------- */
    if (interaction.commandName === "rename") {
      await interaction.deferReply();
      const fromName = interaction.options.getString("from_name");
      const newName = interaction.options.getString("name");

      const char = await Character.findOne({ userId: interaction.user.id, name: fromName });
      if (!char) {
        await interaction.editReply(createEmbed({
      title: "❌ Personaggio non trovato",
      description: `Non hai nessun personaggio chiamato **${fromName}**.`,
      color: 0xff0000
    }));
    return;
      }

      char.name = newName;
      await char.save();

       await interaction.editReply(createEmbed({
    title: "✏️ Rinomina completata",
    description: `Il tuo personaggio **${fromName}** è stato rinominato in **${newName}**.`,
    color: 0x00ff99
  }));
  return;
    }


    /* ---------- DELETEPG ---------- */
    if (interaction.commandName === "deletepg") {
     await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const fromName = interaction.options.getString("from_name");
      const char = await Character.findOne({ userId: interaction.user.id, name: fromName });
      if (!char) {
        await interaction.editReply(createEmbed({
      title: "❌ Personaggio non trovato",
      description: `Non hai nessun personaggio chiamato **${fromName}**.`,
      color: 0xff0000
    }));
    return;
      }

      await Character.deleteOne({ _id: char._id });
      await interaction.editReply(createEmbed({
    title: "🗑️ Personaggio eliminato",
    description: `Il personaggio **${char.name}** è stato eliminato con successo.`,
    color: 0x00ff99
  }));
  return;
    }

/* ---------- SHOW ---------- */
if (interaction.commandName === "show") {
  await interaction.deferReply(); // subito, così l'interaction non scade

  const targetUser = interaction.options.getUser("user");
  const name = interaction.options.getString("from_name");

  if (!name || name === "none") {
    await interaction.editReply({
      embeds: [{
        title: "❌ Errore",
        description: "Devi selezionare un personaggio valido.",
        color: 0xff0000
      }]
    });
    return;
  }

  const char = await Character.findOne({ userId: targetUser.id, name });
  if (!char) {
    await interaction.editReply({
      embeds: [{
        title: "❌ Personaggio non trovato",
        description: `**${name}** non trovato per ${targetUser.username}.`,
        color: 0xff0000
      }]
    });
    return;
  }

  // Calcolo livello attuale
  const entry = [...expTable].reverse().find(([expReq]) => char.expTotale >= expReq);
  const livello = entry ? entry[1] : 1;

  // Barra infamia (10 blocchi)
  const infamy = char.infamy ?? 0;
  const progress = Math.min(1, infamy / 1000);
  const filledBlocks = Math.round(progress * 10);
  const emptyBlocks = 10 - filledBlocks;
  let infamyBar = "🟥".repeat(filledBlocks) + "⬜".repeat(emptyBlocks);

  // Se ha almeno 1000 infamia e non è al livello massimo
  const maxLevel = expTable[expTable.length - 1][1];
  if (infamy >= 1000 && livello < maxLevel) {
    infamyBar += "\n✨ level-up disponibile ✨";
  }

  const color = 0x808080;

  const vantaggiText = char.vantaggi?.length
    ? char.vantaggi
        .map(v => `${v.nome} (${v.modificatore >= 0 ? `+${v.modificatore}` : v.modificatore})`)
        .join("\n ")
    : "Nessuno";

  // Embed finale
  const embed = {
    title: `📄 ${char.name}`,
    color,
    fields: [
      { name: "📈 Livello", value: `${livello}\n`, inline: true },
      { name: "📊 Avanzamento infamia", value: `${infamyBar}\n`, inline: false },
      { name: "💰 Soldi", value: `${char.money}💰\n`, inline: true },
      { name: "😈 Infamia", value: `${infamy}😈\n`, inline: true },
      { name: "🎯 Vantaggi", value: `${vantaggiText}`, inline: false }
    ],
    image: { url: char.image || null },
    footer: { text: `Creato da ${targetUser.username}` }
  };

  await interaction.editReply({ embeds: [embed] });
  return;
}


    /* ---------- HELP ---------- */
if (interaction.commandName === "help") {
  await interaction.deferReply();

  const isAdmin = interaction.member.roles.cache.has(ADMIN_ROLE_ID);

  const userCommands = [
    "`/create` – Crea un nuovo personaggio",
    "`/show` – Mostra la scheda di un personaggio",
    "`/list` – Mostra la lista dei personaggi",
    "`/rename` – Rinomina un tuo personaggio",
    "`/changeimage` – modifica l'immagine di un tuo personaggio",
    "`/deletepg` – Elimina uno dei tuoi personaggi",
    "`/pay` – Paga un altro personaggio",
  ];

  const adminCommands = [
    "`/modifymoney` – Aggiungi o rimuovi soldi",
    "`/advantage` – Aggiungi vantaggio",
    "`/removeadvantage` – Rimuovi vantaggio"
  ];

  const embed = {
    title: "📘 Comandi disponibili",
    color: isAdmin ? 0x00ff99 : 0x0099ff,
    fields: [
      {
        name: "🧍‍♂️ Comandi utente",
        value: userCommands.join("\n"),
        inline: false
      },
      ...(isAdmin ? [{
        name: "🔒 Comandi admin",
        value: adminCommands.join("\n"),
        inline: false
      }] : [])
    ],
    footer: { text: isAdmin ? "Hai accesso completo ai comandi." : "Non hai il ruolo admin, quindi vedi solo i comandi base." }
  };

  await interaction.editReply({ embeds: [embed] });
  return;
}

/* ---------- DAILY ---------- */
if (interaction.commandName === "daily") {
  // Risposta ephemeral con i flag
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const chars = await Character.find({ userId });

  if (!chars.length) {
    await interaction.editReply(createEmbed({
      title: "❌ Nessun personaggio",
      description: "Non hai personaggi su cui fare il claim giornaliero.",
      color: 0xff0000
    }));
    return;
  }

  const todayKey = new Date().toDateString(); // es. "Fri Nov 07 2025"
  let claimedCount = 0;

  for (const char of chars) {
    const lastKey = char.lastDaily ? new Date(char.lastDaily).toDateString() : null;

    if (lastKey !== todayKey) {
      char.money += 100;
      char.lastDaily = new Date();
      await char.save();
      claimedCount++;
    }
  }

  if (claimedCount === 0) {
    await interaction.editReply(createEmbed({
      title: "⏳ Daily già riscattato",
      description: "Hai già fatto il claim giornaliero per tutti i tuoi personaggi. Riprova dopo mezzanotte!",
      color: 0xff0000
    }));
  } else {
    await interaction.editReply(createEmbed({
      title: "✅ Daily claim effettuato",
      description: `Hai ricevuto **100💰** per ciascun personaggio.\nPersonaggi aggiornati: ${claimedCount}`,
      color: 0x00ff99
    }));
  }
  return;
}

     /* ---------- MODIFYINFAMY ---------- */
    if (interaction.commandName === "modifyinfamy") {
  await interaction.deferReply();
  if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
    await interaction.editReply(createEmbed({
      title: "⛔ Permesso negato",
      description: "Non hai il permesso per usare questo comando.",
      color: 0xff0000
    }));
    return;
  }

  const user = interaction.options.getUser("to_user");
  const name = interaction.options.getString("to_name");
  const amount = interaction.options.getInteger("amount");

  const character = await Character.findOne({ userId: user.id, name });
  if (!character) {
    await interaction.editReply(createEmbed({
      title: "❌ Personaggio non trovato",
      description: `**${name}** non trovato per ${user.username}.`,
      color: 0xff0000
    }));
    return;
  }

  character.infamy += amount;
  await character.save();

  await interaction.editReply(createEmbed({
    title: "😈 Modifica infamia",
    description: `Aggiunti **${amount}** punti infamia a **${character.name}** di ${user.username}.\nTotale: ${character.infamy}🔥`,
    color: 0x00ff99
  }));
  return;
}

/* ---------- LEVELUP ---------- */
if (interaction.commandName === "levelup") {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const fromName = interaction.options.getString("from_name");
  const char = await Character.findOne({ userId: interaction.user.id, name: fromName });

  if (!char) {
    await interaction.editReply(createEmbed({
      title: "❌ Personaggio non trovato",
      description: `Non hai nessun personaggio chiamato **${fromName}**.`,
      color: 0xff0000
    }));
    return;
  }

  if (char.infamy < 1000) {
    await interaction.editReply(createEmbed({
      title: "❌ Infamia insufficiente",
      description: `**${char.name}** ha solo ${char.infamy}😈. Servono almeno 1000😈 per salire di livello.`,
      color: 0xff0000
    }));
    return;
  }

  // Calcolo nuovo livello
  const newLevel = char.level + 1;
  const newBaseExp = expTable.find(([_, lvl]) => lvl === newLevel)?.[0];

  if (!newBaseExp) {
    await interaction.editReply(createEmbed({
      title: "🚫 Livello massimo raggiunto",
      description: `**${char.name}** è già al livello massimo (${char.level}).`,
      color: 0xff0000
    }));
    return;
  }

  char.level = newLevel;
  char.expTotale = newBaseExp;
  char.expMostrata = 0;
  char.infamy -= 1000;
  await char.save();

  await interaction.editReply(createEmbed({
    title: "😈 Livello acquistato",
    description: `**${char.name}** ha speso **1000😈** per salire al livello **${newLevel}**!\n` +
                 `Exp impostata a ${newBaseExp} | Infamia residua: ${char.infamy}😈`,
    color: 0x00ff99
  }));
  return;
}


    /* ---------- CHANGEIMAGE ---------- */
if (interaction.commandName === "changeimage") {
  await interaction.deferReply();

  const name = interaction.options.getString("from_name");
  const image = interaction.options.getAttachment("image");

  if (!image || !image.contentType?.startsWith("image/")) {
    await interaction.editReply(createEmbed({
      title: "❌ Errore",
      description: "Devi caricare un file immagine valido (jpg, png, ecc).",
      color: 0xff0000
    }));
    return;
  }

  const char = await Character.findOne({ userId: interaction.user.id, name });
  if (!char) {
    await interaction.editReply(createEmbed({
      title: "❌ Personaggio non trovato",
      description: `Non hai nessun personaggio chiamato **${name}**.`,
      color: 0xff0000
    }));
    return;
  }

  const mediaChannelId = "1272793692301819926"; // ← ID del canale media
  const mediaChannel = client.channels.cache.get(mediaChannelId);

  if (!mediaChannel || !mediaChannel.isTextBased()) {
    await interaction.editReply(createEmbed({
      title: "❌ Errore",
      description: "Il canale media non è accessibile o non è testuale.",
      color: 0xff0000
    }));
    return;
  }

  let uploadedMessage;
  try {
    uploadedMessage = await mediaChannel.send({
      content: `📸 Nuova immagine per **${char.name}** di <@${interaction.user.id}>`,
      files: [image]
    });
  } catch (err) {
    console.error("Errore upload immagine:", err);
    await interaction.editReply(createEmbed({
      title: "❌ Errore",
      description: "Non sono riuscito a caricare l'immagine nel canale media.",
      color: 0xff0000
    }));
    return;
  }

  const permanentUrl = uploadedMessage.attachments.first()?.url;
  if (!permanentUrl) {
    await interaction.editReply(createEmbed({
      title: "❌ Errore",
      description: "Non sono riuscito a ottenere il link permanente dell'immagine.",
      color: 0xff0000
    }));
    return;
  }

  char.image = permanentUrl;
  await char.save();

  await interaction.editReply({
    embeds: [{
      title: `✅ Immagine aggiornata per ${char.name}`,
      description: `Modificata da <@${interaction.user.id}>`,
      image: { url: permanentUrl },
      color: 0x00ff99
    }]
  });
  return;
}



  } catch (err) {
    console.error("❌ Errore in interactionCreate:", err);
    try {
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply("⚠️ Errore interno, riprova più tardi.");
      } else if (interaction.isRepliable()) {
        await interaction.reply({ content: "⚠️ Errore interno, riprova più tardi." });
      }
    } catch {}
  }
});

/* ======================= LOGIN ======================= */
client.login(process.env.DISCORD_TOKEN);
