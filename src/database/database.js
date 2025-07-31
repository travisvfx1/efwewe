const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

class Database {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    // Zorg ervoor dat de data directory bestaat
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new sqlite3.Database(config.database.path, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database');
        this.createTables();
      }
    });
  }

  createTables() {
    const tables = [
      // Tabel voor het opslaan van gevolgde Vinted zoekqueries
      `CREATE TABLE IF NOT EXISTS searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        query TEXT NOT NULL,
        url TEXT NOT NULL,
        price_min REAL,
        price_max REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
      )`,

      // Tabel voor het opslaan van gevonden Vinted items
      `CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vinted_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        price REAL NOT NULL,
        currency TEXT DEFAULT 'EUR',
        size TEXT,
        brand TEXT,
        condition TEXT,
        url TEXT NOT NULL,
        image_url TEXT,
        seller_name TEXT,
        location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Tabel voor het bijhouden welke items al zijn gemeld
      `CREATE TABLE IF NOT EXISTS notified_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        search_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (search_id) REFERENCES searches (id),
        FOREIGN KEY (item_id) REFERENCES items (id),
        UNIQUE(search_id, item_id)
      )`,

      // Tabel voor gebruikersinstellingen
      `CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        notifications_enabled BOOLEAN DEFAULT 1,
        max_price_alerts REAL,
        preferred_brands TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    tables.forEach(table => {
      this.db.run(table, (err) => {
        if (err) {
          console.error('Error creating table:', err.message);
        }
      });
    });
  }

  // Search management
  addSearch(guildId, channelId, userId, query, url, priceMin = null, priceMax = null) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO searches (guild_id, channel_id, user_id, query, url, price_min, price_max)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([guildId, channelId, userId, query, url, priceMin, priceMax], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  getActiveSearches() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM searches 
        WHERE is_active = 1 
        ORDER BY last_checked ASC
      `, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getUserSearches(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM searches 
        WHERE user_id = ? AND is_active = 1 
        ORDER BY created_at DESC
      `, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  updateSearchLastChecked(searchId) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE searches 
        SET last_checked = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [searchId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  removeSearch(searchId, userId) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE searches 
        SET is_active = 0 
        WHERE id = ? AND user_id = ?
      `, [searchId, userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  // Item management
  addItem(vintedId, title, price, currency, size, brand, condition, url, imageUrl, sellerName, location) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO items 
        (vinted_id, title, price, currency, size, brand, condition, url, image_url, seller_name, location, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run([vintedId, title, price, currency, size, brand, condition, url, imageUrl, sellerName, location], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  getItemByVintedId(vintedId) {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM items WHERE vinted_id = ?
      `, [vintedId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Notification tracking
  markItemNotified(searchId, itemId) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR IGNORE INTO notified_items (search_id, item_id)
        VALUES (?, ?)
      `, [searchId, itemId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  isItemNotified(searchId, itemId) {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT 1 FROM notified_items 
        WHERE search_id = ? AND item_id = ?
      `, [searchId, itemId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
  }

  // User settings
  getUserSettings(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM user_settings WHERE user_id = ?
      `, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  updateUserSettings(userId, settings) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO user_settings 
        (user_id, notifications_enabled, max_price_alerts, preferred_brands, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run([
        userId, 
        settings.notifications_enabled, 
        settings.max_price_alerts, 
        settings.preferred_brands
      ], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
      
      stmt.finalize();
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('Database connection closed.');
        }
      });
    }
  }
}

module.exports = new Database();