// index.js
import http from "http";
import { Client, GatewayIntentBits, REST, Routes, Events, MessageFlags } from "discord.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

/* ======================= FUNZIONE EMBED ======================= */
function createEmbed({ title, description, color = 0x0099ff }) {
  return { embeds: [{ title, description, color }] };
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
  lastDaily: { type: Date, default: null },
  level: { type: Number, default: 1 },
  expTotale: { type: Number, default: 0 },
  expMostrata: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  vantaggi: { type: [{ nome: String, modificatore: Number }], default: [] }
});
const Character = mongoose.model("Character", characterSchema);

/* ======================= EXP TABLE ======================= */
const expTable = [
  [0, 1], [2000, 2], [5000, 3], [9000, 4], [14000, 5], [20000, 6],
  [27000, 7], [35000, 8], [44000, 9], [54000, 10], [65000, 11],
  [77000, 12], [90000, 13], [104000, 14], [119000, 15], [135000, 16],
  [152000, 17], [170000, 18], [189000, 19], [209000, 20], [230000, 21],
  [252000, 22], [275000, 23], [299000, 24], [324000, 25], [350000, 26],
  [377000, 27], [405000, 28], [434000, 29], [464000, 30], [495000, 31],
  [527000, 32], [560000, 33], [594000, 34], [629000, 35], [665000, 36],
  [702000, 37], [740000, 38], [779000, 39], [819000, 40], [860000, 41],
  [902000, 42], [945000, 43], [989000, 44], [1034000, 45], [1080000, 46],
  [1127000, 47], [1175000, 48], [1224000, 49], [1274000, 50],
  [1325000, 51], [1377000, 52], [1430000, 53], [1484000, 54],
  [1539000, 55], [1595000, 56], [1652000, 57], [1710000, 58],
  [1769000, 59], [1829000, 60], [1890000, 61], [1952000, 62],
  [2015000, 63], [2079000, 64], [2144000, 65], [2210000, 66],
  [2277000, 67], [2345000, 68], [2414000, 69], [2484000, 70],
  [2555000, 71], [2627000, 72], [2700000, 73], [2774000, 74],
  [2849000, 75], [2925000, 76], [3002000, 77], [3080000, 78],
  [3159000, 79], [3239000, 80], [3320000, 81], [3402000, 82],
  [3485000, 83], [3569000, 84], [3654000, 85], [3740000, 86],
  [3827000, 87], [3915000, 88], [4004000, 89], [4094000, 90],
  [4185000, 91], [4277000, 92], [4370000, 93], [4464000, 94],
  [4559000, 95], [4655000, 96], [4752000, 97], [4850000, 98],
  [4949000, 99], [5049000, 100]
];
const maxExp = 5049000;

/* ======================= DISCORD CLIENT ======================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

/* ======================= PERMESSI ADMIN ======================= */
const ADMIN_ROLE_ID = "1272491698538414120";

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
    name: "addexp",
    description: "(ADMIN ONLY) Aggiungi punti esperienza a un personaggio",
    options: [
      { name: "to_user", type: 6, description: "Utente proprietario del personaggio", required: true },
      { name: "to_name", type: 3, description: "Nome del personaggio", required: true, autocomplete: true },
      { name: "amount", type: 4, description: "Quantità di exp da aggiungere", required: true },
    ],
  },
  {
    name: "removeexp",
    description: "(ADMIN ONLY) Rimuovi exp a un personaggio",
    options: [
      { name: "to_user", type: 6, description: "Utente proprietario del personaggio", required: true },
      { name: "to_name", type: 3, description: "Nome del personaggio", required: true, autocomplete: true },
      { name: "amount", type: 4, description: "Quantità di exp da rimuovere", required: true },
    ],
  },
  {
    name: "deletepg",
    description: "Elimina uno dei tuoi personaggi",
    options: [
      { type: 3, name: "from_name", description: "Nome del personaggio da eliminare", required: true, autocomplete: true }
    ]
  },
  {
  name: "advantage",
  description: "(ADMIN ONLY) Aggiungi un vantaggio a un personaggio",
  options: [
    { name: "to_user", type: 6, description: "Utente proprietario del personaggio", required: true },
    { name: "to_name", type: 3, description: "Nome del personaggio", required: true, autocomplete: true },
    { name: "nome", type: 3, description: "Nome del vantaggio", required: true },
    { name: "modificatore", type: 4, description: "Modificatore per i dadi", required: true }
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
  name: "removeadvantage",
  description: "(ADMIN ONLY) Rimuovi un vantaggio da un personaggio",
  options: [
    { name: "to_user", type: 6, description: "Utente proprietario del personaggio", required: true },
    { name: "to_name", type: 3, description: "Nome del personaggio", required: true, autocomplete: true },
    { name: "nome", type: 3, description: "Nome del vantaggio da rimuovere", required: true }
  ]
},
  {
  name: "daily",
  description: "Claim giornaliero: ottieni 100💰 per ogni tuo personaggio"
},
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

  await interaction.editReply({
    embeds: [{
      title: `✅ Personaggio creato: ${name}`,
      description: `Creato da <@${interaction.user.id}>`,
      image: { url: permanentUrl },
      color: 0x00ff99
    }]
  });
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
      const expBase = entry ? entry[0] : 0;
      const nextExp = expTable.find(([_, lvl]) => lvl === livello + 1)?.[0] ?? expBase;
      const expMostrata = c.expTotale - expBase;
      const nextDelta = Math.max(0, nextExp - expBase);

      return `- ${c.name}
  Livello: ${livello}
  Exp: ${expMostrata} / ${nextDelta}
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

    /* ---------- ADDEXP ---------- */
    if (interaction.commandName === "addexp") {
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

      if (amount <= 0) {
       await interaction.editReply(createEmbed({
      title: "❌ Valore non valido",
      description: "L'esperienza deve essere un numero positivo maggiore di zero.",
      color: 0xff0000
    }));
    return;
      }

      const char = await Character.findOne({ userId: user.id, name });
      if (!char) {
        await interaction.editReply(createEmbed({
      title: "❌ Personaggio non trovato",
      description: `**${name}** non trovato per ${user.username}.`,
      color: 0xff0000
    }));
    return;
      }

      char.expTotale += amount;
      if (char.expTotale > maxExp) char.expTotale = maxExp;

      let newLevel = 1;
      for (let i = expTable.length - 1; i >= 0; i--) {
        if (char.expTotale >= expTable[i][0]) {
          newLevel = expTable[i][1];
          char.expMostrata = char.expTotale - expTable[i][0];
          break;
        }
      }

      const oldLevel = char.level;
      char.level = newLevel;

      if (newLevel > oldLevel) {
        const diff = newLevel - oldLevel;
      }

      await char.save();

      if (newLevel > oldLevel) {
         await interaction.editReply(createEmbed({
      title: "🎉 Livello aumentato!",
      description: `**${char.name}** è salito al livello **${newLevel}**!\n` +
                   `Exp attuale: ${char.expMostrata} / prossimo livello`,
      color: 0x00ff99
    }));
      } else {
        await interaction.editReply(createEmbed({
      title: "✅ Esperienza aggiunta",
      description: `Aggiunti **${amount} exp** a **${char.name}**.\n` +
                   `Livello attuale: ${char.level} | Exp: ${char.expMostrata}`,
      color: 0x00ff99
    }));
  }
  return;
    }

    /* ---------- REMOVEEXP ---------- */
    if (interaction.commandName === "removeexp") {
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

      if (amount <= 0) {
        await interaction.editReply(createEmbed({
      title: "❌ Valore non valido",
      description: "Devi inserire un numero positivo di exp da rimuovere.",
      color: 0xff0000
    }));
    return;
      }

      const character = await Character.findOne({ userId: user.id, name });
      if (!character) {
        await interaction.editReply(createEmbed({
      title: "❌ Personaggio non trovato",
      description: `**${name}** non trovato per ${user.username}.`,
      color: 0xff0000
    }));
    return;
      }

      character.expTotale = Math.max(0, character.expTotale - amount);

      const entry = [...expTable].reverse().find(([expReq]) => character.expTotale >= expReq);
      const livello = entry ? entry[1] : 1;
      const expBase = entry ? entry[0] : 0;
      const nextExp = expTable.find(([_, lvl]) => lvl === (livello + 1))?.[0] ?? expBase;
      const expMostrata = character.expTotale - expBase;

      const oldLevel = character.level;
      character.level = livello;
      character.expMostrata = expMostrata;

      if (livello < oldLevel) {
        const diff = oldLevel - livello;
      }

      await character.save();

    await interaction.editReply(createEmbed({
    title: "📉 Exp rimossa",
    description: `Rimossi **${amount} exp** da **${character.name}** di ${user.username}.\n` +
                 `Livello attuale: ${livello}\n` +
                 `Exp: ${expMostrata} / ${nextExp - expBase}`,
    color: 0x00ff99
  }));
  return;
    }


    /* ---------- DELETEPG ---------- */
    if (interaction.commandName === "deletepg") {
      await interaction.deferReply({ ephemeral: true });

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

  // Calcolo livello ed exp
  const entry = [...expTable].reverse().find(([expReq]) => char.expTotale >= expReq);
  const livello = entry ? entry[1] : 1;
  const expBase = entry ? entry[0] : 0;
  const nextExp = expTable.find(([_, lvl]) => lvl === livello + 1)?.[0] ?? expBase;
  const expMostrata = char.expTotale - expBase;
  const nextDelta = Math.max(0, nextExp - expBase);

  // Barra exp (10 blocchi)
  const progress = nextDelta > 0 ? Math.min(1, expMostrata / nextDelta) : 1;
  const filledBlocks = Math.round(progress * 10);
  const emptyBlocks = 10 - filledBlocks;
  const expBar = "🟩".repeat(filledBlocks) + "⬜".repeat(emptyBlocks);

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
      { name: "⭐ Exp", value: `${expMostrata} / ${nextDelta}\n`, inline: true },
      { name: "📊 Avanzamento", value: `${expBar}\n`, inline: false },
      { name: "💰 Soldi", value: `${char.money}💰\n`, inline: true },
      { name: "🎯 Vantaggi", value: `${vantaggiText}`, inline: false }
    ],
    image: { url: char.image || null },
    footer: { text: `Creato da ${targetUser.username}` }
  };

  await interaction.editReply({ embeds: [embed] });
  return;
}



/* ---------- ADVANTAGE ---------- */
if (interaction.commandName === "advantage") {
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
  const vantaggioNome = interaction.options.getString("nome");
  const modificatore = interaction.options.getInteger("modificatore");

  const char = await Character.findOne({ userId: user.id, name });
  if (!char) {
  await interaction.editReply(createEmbed({
      title: "❌ Personaggio non trovato",
      description: `**${name}** non trovato per ${user.username}.`,
      color: 0xff0000
    }));
    return;
  }

  if (!Array.isArray(char.vantaggi)) char.vantaggi = [];
  char.vantaggi.push({ nome: vantaggioNome, modificatore });
  await char.save();

  await interaction.editReply(createEmbed({
    title: "✅ Vantaggio aggiunto",
    description: `Aggiunto vantaggio **${vantaggioNome}** (modificatore: ${modificatore}) a **${char.name}**.`,
    color: 0x00ff99
  }));
  return;
}

/* ---------- REMOVEADVANTAGE ---------- */
if (interaction.commandName === "removeadvantage") {
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
  const vantaggioNome = interaction.options.getString("nome");

  const char = await Character.findOne({ userId: user.id, name });
  if (!char) {
   await interaction.editReply(createEmbed({
      title: "❌ Personaggio non trovato",
      description: `**${name}** non trovato per ${user.username}.`,
      color: 0xff0000
    }));
    return;
  }

  if (!Array.isArray(char.vantaggi)) char.vantaggi = [];

  const idx = char.vantaggi.findIndex(v => v.nome.toLowerCase() === vantaggioNome.toLowerCase());
  if (idx === -1) {
   await interaction.editReply(createEmbed({
      title: "❌ Vantaggio non trovato",
      description: `Il vantaggio **${vantaggioNome}** non è presente in **${char.name}**.`,
      color: 0xff0000
    }));
    return;
  }

  const removed = char.vantaggi.splice(idx, 1)[0];
  await char.save();

  await interaction.editReply(createEmbed({
    title: "🗑️ Vantaggio rimosso",
    description: `Rimosso vantaggio **${removed.nome}** (modificatore: ${removed.modificatore}) da **${char.name}**.`,
    color: 0x808080
  }));
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
    "`/addexp` – Aggiungi exp",
    "`/removeexp` – Rimuovi exp",
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

  const today = new Date();
  const todayKey = today.toDateString(); // es. "Fri Nov 07 2025"
  let claimedCount = 0;

  for (const char of chars) {
    const lastKey = char.lastDaily ? new Date(char.lastDaily).toDateString() : null;

    if (lastKey !== todayKey) {
      char.money += 100;
      char.lastDaily = today;
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






































