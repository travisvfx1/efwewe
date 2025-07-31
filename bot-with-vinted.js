const { Client, GatewayIntentBits, REST, Routes, Collection } = require('discord.js');
const VintedModule = require('./VintedModule');
require('dotenv').config();

// ===== CONFIGURATIE =====
// Vervang deze waarden met jouw eigen bot informatie
const BOT_TOKEN = process.env.DISCORD_TOKEN || 'JOUW_BOT_TOKEN_HIER';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'JOUW_CLIENT_ID_HIER';

// Vinted module configuratie
const VINTED_CONFIG = {
  dbPath: './data/vinted_database.db',
  checkInterval: '*/5 * * * *', // Elke 5 minuten
  maxItemsPerCheck: 15
};

// ===== BOT SETUP =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Commands collection voor als je andere commands hebt
client.commands = new Collection();

// ===== VINTED MODULE =====
let vintedModule;

// ===== EVENT HANDLERS =====
client.once('ready', async () => {
  console.log(`🤖 Bot is online als ${client.user.tag}!`);
  console.log(`📊 Actief in ${client.guilds.cache.size} server(s)`);
  
  // Start Vinted module
  try {
    console.log('🔄 Vinted module wordt geladen...');
    vintedModule = new VintedModule(client, VINTED_CONFIG);
    
    // Registreer slash commands
    await registerSlashCommands();
    
    console.log('✅ Alles is klaar! Vinted tracking is actief.');
  } catch (error) {
    console.error('❌ Error bij laden van Vinted module:', error);
  }
});

// Error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

// Rate limit warnings
client.on('warn', info => {
  console.warn('Discord warning:', info);
});

// ===== COMMAND REGISTRATION =====
async function registerSlashCommands() {
  const commands = [];
  
  // Voeg Vinted commands toe
  if (vintedModule && vintedModule.commands) {
    vintedModule.commands.forEach(command => {
      commands.push(command.data.toJSON());
    });
  }
  
  // Hier kun je andere commands toevoegen:
  // commands.push(jouwAndereCommand.data.toJSON());
  
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  
  try {
    console.log('🔄 Slash commands worden geregistreerd...');
    
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    
    console.log(`✅ ${commands.length} slash command(s) geregistreerd!`);
  } catch (error) {
    console.error('❌ Error bij command registratie:', error);
  }
}

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
  console.log('🛑 Bot wordt afgesloten...');
  
  try {
    if (vintedModule) {
      console.log('📄 Vinted module wordt afgesloten...');
      await vintedModule.destroy();
    }
    
    console.log('🔌 Discord verbinding wordt verbroken...');
    client.destroy();
    
    console.log('✅ Bot succesvol afgesloten');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error bij afsluiten:', error);
    process.exit(1);
  }
}

// ===== EXTRA FEATURES (optioneel) =====

// Log wanneer bot wordt toegevoegd aan nieuwe server
client.on('guildCreate', guild => {
  console.log(`➕ Bot toegevoegd aan nieuwe server: ${guild.name} (${guild.memberCount} members)`);
});

// Log wanneer bot wordt verwijderd van server
client.on('guildDelete', guild => {
  console.log(`➖ Bot verwijderd van server: ${guild.name}`);
});

// ===== START BOT =====
console.log('🚀 Bot wordt gestart...');

client.login(BOT_TOKEN).catch(error => {
  console.error('❌ Kan niet inloggen:', error);
  console.log('💡 Controleer of je DISCORD_TOKEN correct is ingesteld');
  process.exit(1);
});

// ===== EXPORT (voor testing) =====
module.exports = { client, vintedModule };