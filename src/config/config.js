require('dotenv').config();

module.exports = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
  },
  database: {
    path: process.env.DATABASE_PATH || './data/vinted_bot.db',
  },
  vinted: {
    baseUrl: process.env.VINTED_BASE_URL || 'https://www.vinted.nl',
    checkInterval: parseInt(process.env.CHECK_INTERVAL_MINUTES) || 5,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};