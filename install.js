const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Vinted Discord Bot Installatie\n');

// Check Node.js versie
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
  console.error('❌ Node.js 16.0.0 of hoger is vereist!');
  console.log(`   Jouw versie: ${nodeVersion}`);
  console.log('   Download de nieuwste versie van https://nodejs.org/');
  process.exit(1);
}

console.log(`✅ Node.js versie: ${nodeVersion}`);

// Installeer dependencies
console.log('\n📦 Dependencies installeren...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies geïnstalleerd!');
} catch (error) {
  console.error('❌ Error bij installeren dependencies:', error.message);
  process.exit(1);
}

// Maak data directory
const dataDir = './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Data directory aangemaakt');
}

// Check .env bestand
if (!fs.existsSync('.env')) {
  console.log('\n⚠️  Geen .env bestand gevonden!');
  console.log('   Er is een .env bestand aangemaakt.');
  console.log('   Vul je Discord bot token en client ID in voordat je de bot start.');
} else {
  console.log('✅ .env bestand gevonden');
}

console.log('\n🎉 Installatie voltooid!');
console.log('\n📝 Volgende stappen:');
console.log('1. Vul je Discord bot gegevens in het .env bestand in');
console.log('2. Start de bot met: npm start');
console.log('3. Gebruik /vinted-watch in Discord om te beginnen!');

console.log('\n🔗 Bot maken/configureren:');
console.log('   https://discord.com/developers/applications');

console.log('\n📚 Commands die beschikbaar komen:');
console.log('   /vinted-watch   - Begin met volgen van items');
console.log('   /vinted-list    - Bekijk je actieve watches');
console.log('   /vinted-remove  - Stop met volgen');
console.log('   /vinted-search  - Zoek direct op Vinted');

console.log('\n✨ Klaar om te gebruiken!');