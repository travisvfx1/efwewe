// voorbeeld-integration.js
// Dit toont hoe je de VintedModule toevoegt aan een bestaande Discord bot

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const VintedModule = require('./VintedModule');

// Je bestaande Discord bot client
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

// Bot token (vervang met jouw bot token)
const TOKEN = 'YOUR_BOT_TOKEN_HERE';
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';

// Initialiseer de Vinted module
let vintedModule;

client.once('ready', async () => {
  console.log(`Bot is online als ${client.user.tag}!`);
  
  // Start de Vinted module NADAT de bot klaar is
  vintedModule = new VintedModule(client, {
    dbPath: './data/vinted_database.db',
    checkInterval: '*/3 * * * *', // Elke 3 minuten checken
    maxItemsPerCheck: 15
  });

  // Registreer de slash commands
  await registerSlashCommands();
});

// Functie om slash commands te registreren
async function registerSlashCommands() {
  const commands = [];
  
  // Voeg alle Vinted commands toe
  if (vintedModule && vintedModule.commands) {
    vintedModule.commands.forEach(command => {
      commands.push(command.data.toJSON());
    });
  }
  
  // Je kunt hier ook andere commands van je bestaande bot toevoegen
  // commands.push(mijnAndereCommand.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    console.log('🔄 Bezig met het registreren van slash commands...');

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands },
    );

    console.log('✅ Slash commands succesvol geregistreerd!');
  } catch (error) {
    console.error('❌ Error bij het registreren van commands:', error);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Bot wordt afgesloten...');
  
  if (vintedModule) {
    await vintedModule.destroy();
  }
  
  client.destroy();
  process.exit(0);
});

client.login(TOKEN);

/* 
ALTERNATIEVE INTEGRATIE VOOR BESTAANDE BOTS:

Als je al een werkende Discord bot hebt, voeg dit toe:

1. Installeer de dependencies:
   npm install puppeteer node-cron sqlite3

2. Importeer de module:
   const VintedModule = require('./VintedModule');

3. Start de module na client.ready:
   client.once('ready', () => {
     const vintedModule = new VintedModule(client);
   });

4. Voeg de commands toe aan je command registratie systeem
   (zie registerSlashCommands functie hierboven)

VOOR DISCORD.JS v13 GEBRUIKERS:
De module is gemaakt voor discord.js v14. Voor v13 wijzig:
- SlashCommandBuilder naar CommandBuilder
- EmbedBuilder naar MessageEmbed
- ButtonBuilder naar MessageButton
- ActionRowBuilder naar MessageActionRow
*/