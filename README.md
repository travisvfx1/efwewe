# 🛍️ Vinted Discord Bot Module

Een krachtige en eenvoudig te integreren module die Vinted functionaliteit toevoegt aan elke bestaande Discord bot! Deze module houdt automatisch Vinted zoekacties bij en stuurt real-time notificaties wanneer er nieuwe items verschijnen.

## ✨ Features

- 🔍 **Automatisch volgen van Vinted searches** - Stel zoektermen in en krijg meldingen van nieuwe items
- 💰 **Prijs filtering** - Stel minimum en maximum prijzen in
- 🔔 **Real-time notificaties** - Directe Discord berichten wanneer er nieuwe items zijn
- 📊 **Overzicht van actieve watches** - Bekijk al je gevolgde zoektermen
- 🎯 **Directe zoekfunctie** - Zoek eenmalig op Vinted zonder tracking
- 🗄️ **Lokale database** - Alle data wordt lokaal opgeslagen
- 🤖 **Modulair ontwerp** - Voeg eenvoudig toe aan elke bestaande Discord bot

## 🚀 Snelle Start

### Vereisten
- Node.js 16.0.0 of hoger
- Een werkende Discord bot
- Discord.js v14

### Installatie

1. **Download de bestanden:**
   ```bash
   # Download VintedModule.js naar je bot directory
   wget https://raw.githubusercontent.com/jouw-repo/VintedModule.js
   ```

2. **Installeer dependencies:**
   ```bash
   npm install puppeteer node-cron sqlite3
   ```

3. **Integreer in je bestaande bot:**
   ```javascript
   const VintedModule = require('./VintedModule');
   
   client.once('ready', () => {
     // Start de Vinted module
     const vintedModule = new VintedModule(client, {
       dbPath: './data/vinted.db',           // Waar de database wordt opgeslagen
       checkInterval: '*/5 * * * *',         // Elke 5 minuten checken
       maxItemsPerCheck: 10                  // Max items per check
     });
   });
   ```

4. **Registreer de slash commands** (zie [example-integration.js](./example-integration.js))

## 🎮 Commands

De module voegt deze slash commands toe aan je bot:

### `/vinted-watch`
Start met het volgen van Vinted items
- **zoekterm**: Wat je wilt zoeken (verplicht)
- **max-prijs**: Maximale prijs in euro (optioneel)
- **min-prijs**: Minimale prijs in euro (optioneel)

**Voorbeeld:**
```
/vinted-watch zoekterm:nike air max max-prijs:50
```

### `/vinted-list`
Bekijk al je actieve Vinted watches

### `/vinted-remove`
Stop met het volgen van een specifieke zoekterm
- **id**: ID van de watch om te verwijderen

### `/vinted-search`
Zoek direct op Vinted (eenmalig, zonder tracking)
- **zoekterm**: Wat je wilt zoeken (verplicht)
- **max-prijs**: Maximale prijs in euro (optioneel)

## ⚙️ Configuratie Opties

```javascript
const vintedModule = new VintedModule(client, {
  dbPath: './vinted_data.db',              // Database locatie
  checkInterval: '*/5 * * * *',            // Cron schema (elke 5 min)
  maxItemsPerCheck: 10                     // Max items per controle
});
```

### Cron Schema Voorbeelden:
- `'*/5 * * * *'` - Elke 5 minuten
- `'*/10 * * * *'` - Elke 10 minuten
- `'0 */1 * * *'` - Elk uur
- `'0 9-17 * * *'` - Elk uur tussen 9:00 en 17:00

## 📱 Hoe het werkt

1. **Voeg een watch toe**: Gebruik `/vinted-watch` met je zoekterm
2. **Automatische controle**: De bot controleert regelmatig Vinted voor nieuwe items
3. **Krijg meldingen**: Wanneer er nieuwe items zijn, krijg je een bericht in het kanaal waar je de watch hebt aangemaakt
4. **Beheer je watches**: Gebruik `/vinted-list` en `/vinted-remove` om je watches te beheren

## 🎯 Voorbeelden

### Een watch toevoegen voor sneakers
```
/vinted-watch zoekterm:nike sneakers maat 42 max-prijs:75
```

### Zoeken naar vintage kleding
```
/vinted-watch zoekterm:vintage jas dames min-prijs:10 max-prijs:30
```

### Direct zoeken zonder tracking
```
/vinted-search zoekterm:iphone 13 max-prijs:400
```

## 🔧 Installatie voor Bestaande Bots

### Voor Discord.js v14 bots:
1. Kopieer `VintedModule.js` naar je project
2. Installeer dependencies: `npm install puppeteer node-cron sqlite3`
3. Voeg de module toe zoals getoond in `example-integration.js`

### Voor Discord.js v13 bots:
Je moet enkele aanpassingen maken in `VintedModule.js`:
- `EmbedBuilder` → `MessageEmbed`
- `ButtonBuilder` → `MessageButton`
- `ActionRowBuilder` → `MessageActionRow`

### Voor bots met bestaand command systeem:
Je kunt de commands handmatig registreren in je eigen command handler:
```javascript
// Krijg de commands van de module
const vintedCommands = vintedModule.commands;

// Voeg ze toe aan je eigen command system
vintedCommands.forEach(command => {
  yourCommandHandler.add(command);
});
```

## 🛠️ Troubleshooting

### "Browser launch failed"
```bash
# Installeer Chrome dependencies (Linux)
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

### "Database locked" errors
Zorg ervoor dat je `vintedModule.destroy()` aanroept wanneer je bot stopt.

### Rate limiting
De module heeft ingebouwde delays tussen requests. Als je toch problemen hebt, verhoog de `checkInterval`.

## ⚠️ Belangrijke Opmerkingen

- **Rate Limiting**: Gebruik niet te lage check intervals om Vinted's servers niet te overbelasten
- **Server Resources**: Puppeteer gebruikt behoorlijk wat geheugen - monitor je server
- **Database**: De SQLite database groeit in de tijd - overweeg periodiek opschonen
- **Vinted ToS**: Zorg ervoor dat je gebruik in lijn is met Vinted's Terms of Service

## 📞 Support

Problemen of vragen? 
- Check de [example-integration.js](./example-integration.js) voor voorbeelden
- Kijk naar de console logs voor error details
- Zorg ervoor dat alle dependencies correct zijn geïnstalleerd

## 📄 Licentie

MIT License - Gebruik vrijelijk in je eigen projecten!

---

Made with ❤️ voor de Discord en Vinted community