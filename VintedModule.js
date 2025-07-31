const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const puppeteer = require('puppeteer');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class VintedModule {
  constructor(client, options = {}) {
    this.client = client;
    this.options = {
      dbPath: options.dbPath || './vinted_data.db',
      checkInterval: options.checkInterval || '*/5 * * * *', // Elke 5 minuten
      maxItemsPerCheck: options.maxItemsPerCheck || 10,
      ...options
    };
    
    this.db = null;
    this.browser = null;
    this.cronJob = null;
    
    this.init();
  }

  async init() {
    await this.setupDatabase();
    await this.setupBrowser();
    this.setupCommands();
    this.setupScheduler();
    
    console.log('✅ Vinted Module geladen!');
  }

  async setupDatabase() {
    // Zorg dat de directory bestaat
    const dbDir = path.dirname(this.options.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new sqlite3.Database(this.options.dbPath);
    
    // Maak tabellen aan
    await this.runQuery(`
      CREATE TABLE IF NOT EXISTS vinted_watches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        search_term TEXT NOT NULL,
        max_price REAL,
        min_price REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
        active BOOLEAN DEFAULT 1
      )
    `);

    await this.runQuery(`
      CREATE TABLE IF NOT EXISTS vinted_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vinted_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        price REAL NOT NULL,
        url TEXT NOT NULL,
        image_url TEXT,
        brand TEXT,
        size TEXT,
        seller TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.runQuery(`
      CREATE TABLE IF NOT EXISTS vinted_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watch_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (watch_id) REFERENCES vinted_watches (id),
        FOREIGN KEY (item_id) REFERENCES vinted_items (id)
      )
    `);
  }

  async setupBrowser() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  }

  setupCommands() {
    // Vinted Watch Command
    const vintedWatchCommand = {
      data: new SlashCommandBuilder()
        .setName('vinted-watch')
        .setDescription('Start met het volgen van Vinted items')
        .addStringOption(option =>
          option.setName('zoekterm')
            .setDescription('Wat wil je zoeken op Vinted?')
            .setRequired(true))
        .addNumberOption(option =>
          option.setName('max-prijs')
            .setDescription('Maximale prijs in euro')
            .setRequired(false))
        .addNumberOption(option =>
          option.setName('min-prijs')
            .setDescription('Minimale prijs in euro')
            .setRequired(false)),
      
      execute: async (interaction) => {
        await this.handleWatchCommand(interaction);
      }
    };

    // Vinted List Command
    const vintedListCommand = {
      data: new SlashCommandBuilder()
        .setName('vinted-list')
        .setDescription('Bekijk je actieve Vinted watches'),
      
      execute: async (interaction) => {
        await this.handleListCommand(interaction);
      }
    };

    // Vinted Remove Command
    const vintedRemoveCommand = {
      data: new SlashCommandBuilder()
        .setName('vinted-remove')
        .setDescription('Stop met het volgen van een Vinted zoekterm')
        .addIntegerOption(option =>
          option.setName('id')
            .setDescription('ID van de watch om te verwijderen')
            .setRequired(true)),
      
      execute: async (interaction) => {
        await this.handleRemoveCommand(interaction);
      }
    };

    // Vinted Search Command (directe zoekactie)
    const vintedSearchCommand = {
      data: new SlashCommandBuilder()
        .setName('vinted-search')
        .setDescription('Zoek direct op Vinted (eenmalig)')
        .addStringOption(option =>
          option.setName('zoekterm')
            .setDescription('Wat wil je zoeken?')
            .setRequired(true))
        .addNumberOption(option =>
          option.setName('max-prijs')
            .setDescription('Maximale prijs in euro')
            .setRequired(false)),
      
      execute: async (interaction) => {
        await this.handleSearchCommand(interaction);
      }
    };

    // Registreer commando's bij de client
    this.commands = [vintedWatchCommand, vintedListCommand, vintedRemoveCommand, vintedSearchCommand];
    
    // Als de client al ready is, registreer direct
    if (this.client.isReady()) {
      this.registerCommands();
    } else {
      this.client.once('ready', () => {
        this.registerCommands();
      });
    }
  }

  registerCommands() {
    // Voeg commando's toe aan client
    this.commands.forEach(command => {
      this.client.commands = this.client.commands || new Map();
      this.client.commands.set(command.data.name, command);
    });

    // Luister naar interactions
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      
      const command = this.client.commands.get(interaction.commandName);
      if (command && command.data.name.startsWith('vinted-')) {
        try {
          await command.execute(interaction);
        } catch (error) {
          console.error('Error executing Vinted command:', error);
          await interaction.reply({ content: 'Er ging iets mis!', ephemeral: true });
        }
      }
    });
  }

  async handleWatchCommand(interaction) {
    await interaction.deferReply();
    
    const searchTerm = interaction.options.getString('zoekterm');
    const maxPrice = interaction.options.getNumber('max-prijs');
    const minPrice = interaction.options.getNumber('min-prijs');
    
    try {
      // Voeg watch toe aan database
      const watchId = await this.runQuery(
        'INSERT INTO vinted_watches (guild_id, channel_id, user_id, search_term, max_price, min_price) VALUES (?, ?, ?, ?, ?, ?)',
        [interaction.guildId, interaction.channelId, interaction.user.id, searchTerm, maxPrice, minPrice]
      );

      const embed = new EmbedBuilder()
        .setColor('#1db584')
        .setTitle('🔍 Vinted Watch Toegevoegd!')
        .setDescription(`Nu aan het volgen: **${searchTerm}**`)
        .addFields(
          { name: 'Watch ID', value: `${watchId}`, inline: true },
          { name: 'Min. Prijs', value: minPrice ? `€${minPrice}` : 'Geen', inline: true },
          { name: 'Max. Prijs', value: maxPrice ? `€${maxPrice}` : 'Geen', inline: true }
        )
        .setFooter({ text: 'Je krijgt hier meldingen wanneer er nieuwe items zijn!' });

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error adding watch:', error);
      await interaction.editReply('❌ Er ging iets mis bij het toevoegen van de watch.');
    }
  }

  async handleListCommand(interaction) {
    try {
      const watches = await this.runQuery(
        'SELECT * FROM vinted_watches WHERE user_id = ? AND active = 1 ORDER BY created_at DESC',
        [interaction.user.id]
      );

      if (!watches || watches.length === 0) {
        await interaction.reply('Je hebt nog geen actieve Vinted watches! Gebruik `/vinted-watch` om er een toe te voegen.');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#1db584')
        .setTitle('📋 Je Vinted Watches')
        .setDescription(`Je hebt ${watches.length} actieve watch(es)`);

      watches.forEach(watch => {
        const priceInfo = [];
        if (watch.min_price) priceInfo.push(`Min: €${watch.min_price}`);
        if (watch.max_price) priceInfo.push(`Max: €${watch.max_price}`);
        const priceString = priceInfo.length > 0 ? ` (${priceInfo.join(', ')})` : '';
        
        embed.addFields({
          name: `ID ${watch.id}: ${watch.search_term}${priceString}`,
          value: `Aangemaakt: <t:${Math.floor(new Date(watch.created_at).getTime() / 1000)}:R>`,
          inline: false
        });
      });

      embed.setFooter({ text: 'Gebruik /vinted-remove <id> om een watch te verwijderen' });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error listing watches:', error);
      await interaction.reply('❌ Er ging iets mis bij het ophalen van je watches.');
    }
  }

  async handleRemoveCommand(interaction) {
    const watchId = interaction.options.getInteger('id');
    
    try {
      const result = await this.runQuery(
        'UPDATE vinted_watches SET active = 0 WHERE id = ? AND user_id = ?',
        [watchId, interaction.user.id]
      );

      if (result.changes > 0) {
        await interaction.reply(`✅ Watch ${watchId} is verwijderd!`);
      } else {
        await interaction.reply('❌ Watch niet gevonden of je hebt geen toegang tot deze watch.');
      }
    } catch (error) {
      console.error('Error removing watch:', error);
      await interaction.reply('❌ Er ging iets mis bij het verwijderen van de watch.');
    }
  }

  async handleSearchCommand(interaction) {
    await interaction.deferReply();
    
    const searchTerm = interaction.options.getString('zoekterm');
    const maxPrice = interaction.options.getNumber('max-prijs');
    
    try {
      const items = await this.scrapeVinted(searchTerm, maxPrice, null, 5);
      
      if (items.length === 0) {
        await interaction.editReply('Geen items gevonden voor je zoekopdracht.');
        return;
      }

      const embeds = items.map(item => this.createItemEmbed(item));
      
      // Verstuur eerste embed met navigatie knoppen als er meerdere items zijn
      if (embeds.length === 1) {
        await interaction.editReply({ embeds: [embeds[0]] });
      } else {
        await interaction.editReply({ 
          embeds: [embeds[0]], 
          content: `Resultaat 1/${embeds.length}`,
          components: [this.createNavigationButtons(0, embeds.length)]
        });
      }
      
    } catch (error) {
      console.error('Error searching Vinted:', error);
      await interaction.editReply('❌ Er ging iets mis bij het zoeken op Vinted.');
    }
  }

  setupScheduler() {
    this.cronJob = cron.schedule(this.options.checkInterval, async () => {
      await this.checkAllWatches();
    }, {
      scheduled: false
    });
    
    this.cronJob.start();
    console.log('📅 Vinted scheduler gestart');
  }

  async checkAllWatches() {
    try {
      const watches = await this.runQuery('SELECT * FROM vinted_watches WHERE active = 1');
      
      for (const watch of watches) {
        await this.checkWatch(watch);
        // Kleine pauze tussen checks om rate limiting te voorkomen
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('Error checking watches:', error);
    }
  }

  async checkWatch(watch) {
    try {
      const items = await this.scrapeVinted(watch.search_term, watch.max_price, watch.min_price, this.options.maxItemsPerCheck);
      
      for (const item of items) {
        // Check of item al bestaat
        const existingItem = await this.runQuery('SELECT * FROM vinted_items WHERE vinted_id = ?', [item.vintedId]);
        
        if (!existingItem) {
          // Nieuw item! Voeg toe aan database
          const itemId = await this.runQuery(
            'INSERT INTO vinted_items (vinted_id, title, price, url, image_url, brand, size, seller) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [item.vintedId, item.title, item.price, item.url, item.imageUrl, item.brand, item.size, item.seller]
          );

          // Check of we dit item al hebben gemeld voor deze watch
          const alreadyNotified = await this.runQuery(
            'SELECT * FROM vinted_notifications WHERE watch_id = ? AND item_id = ?',
            [watch.id, itemId]
          );

          if (!alreadyNotified) {
            // Verstuur notificatie
            await this.sendNotification(watch, item);
            
            // Markeer als gemeld
            await this.runQuery(
              'INSERT INTO vinted_notifications (watch_id, item_id) VALUES (?, ?)',
              [watch.id, itemId]
            );
          }
        }
      }

      // Update last_checked
      await this.runQuery('UPDATE vinted_watches SET last_checked = CURRENT_TIMESTAMP WHERE id = ?', [watch.id]);
      
    } catch (error) {
      console.error(`Error checking watch ${watch.id}:`, error);
    }
  }

  async sendNotification(watch, item) {
    try {
      const channel = await this.client.channels.fetch(watch.channel_id);
      if (!channel) return;

      const embed = this.createItemEmbed(item);
      embed.setAuthor({ name: `🔔 Nieuwe Vinted vondst voor: ${watch.search_term}` });
      embed.setColor('#00ff00');

      await channel.send({ 
        content: `<@${watch.user_id}>`, 
        embeds: [embed] 
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  createItemEmbed(item) {
    const embed = new EmbedBuilder()
      .setTitle(item.title)
      .setURL(item.url)
      .setColor('#1db584')
      .addFields(
        { name: '💰 Prijs', value: `€${item.price}`, inline: true },
        { name: '👕 Maat', value: item.size || 'Onbekend', inline: true },
        { name: '🏷️ Merk', value: item.brand || 'Onbekend', inline: true }
      );

    if (item.seller) {
      embed.addFields({ name: '👤 Verkoper', value: item.seller, inline: true });
    }

    if (item.imageUrl) {
      embed.setImage(item.imageUrl);
    }

    embed.setFooter({ text: 'Klik op de titel om naar Vinted te gaan' });
    embed.setTimestamp();

    return embed;
  }

  createNavigationButtons(currentIndex, totalItems) {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`vinted_prev_${currentIndex}`)
          .setLabel('⬅️ Vorige')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentIndex === 0),
        new ButtonBuilder()
          .setCustomId(`vinted_next_${currentIndex}`)
          .setLabel('Volgende ➡️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentIndex >= totalItems - 1)
      );
  }

  async scrapeVinted(searchTerm, maxPrice = null, minPrice = null, maxItems = 10) {
    const page = await this.browser.newPage();
    
    try {
      // Bouw URL
      let url = `https://www.vinted.nl/vetements?search_text=${encodeURIComponent(searchTerm)}&order=newest_first`;
      if (maxPrice) url += `&price_to=${maxPrice}`;
      if (minPrice) url += `&price_from=${minPrice}`;

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wacht op items
      await page.waitForSelector('div[data-testid="feed-grid"]', { timeout: 10000 });

      const items = await page.evaluate((maxItems) => {
        const itemElements = document.querySelectorAll('div[data-testid="feed-grid"] > div');
        const results = [];

        for (let i = 0; i < Math.min(itemElements.length, maxItems); i++) {
          const element = itemElements[i];
          
          try {
            const linkElement = element.querySelector('a[href*="/items/"]');
            if (!linkElement) continue;
            
            const href = linkElement.getAttribute('href');
            const url = href.startsWith('http') ? href : `https://www.vinted.nl${href}`;
            
            const vintedIdMatch = href.match(/\/items\/(\d+)/);
            if (!vintedIdMatch) continue;
            
            const titleElement = element.querySelector('span') || element.querySelector('p');
            const title = titleElement ? titleElement.textContent.trim() : 'Geen titel';
            
            const priceElement = element.querySelector('span');
            let price = 0;
            if (priceElement && priceElement.textContent.includes('€')) {
              const priceMatch = priceElement.textContent.match(/€[\s]*([\d,\.]+)/);
              if (priceMatch) {
                price = parseFloat(priceMatch[1].replace(',', '.'));
              }
            }
            
            const imgElement = element.querySelector('img');
            const imageUrl = imgElement ? imgElement.getAttribute('src') : null;
            
            results.push({
              vintedId: vintedIdMatch[1],
              title,
              price,
              url,
              imageUrl,
              brand: null,
              size: null,
              seller: null
            });
            
          } catch (error) {
            console.error('Error parsing item:', error);
            continue;
          }
        }

        return results;
      }, maxItems);

      return items;
      
    } catch (error) {
      console.error('Error scraping Vinted:', error);
      return [];
    } finally {
      await page.close();
    }
  }

  // Database helper
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (sql.toLowerCase().startsWith('select')) {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows.length === 0 ? null : (rows.length === 1 ? rows[0] : rows));
        });
      } else {
        this.db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      }
    });
  }

  // Cleanup
  async destroy() {
    if (this.cronJob) {
      this.cronJob.destroy();
    }
    if (this.browser) {
      await this.browser.close();
    }
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = VintedModule;