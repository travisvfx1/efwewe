const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config/config');

class VintedScraper {
  constructor() {
    this.browser = null;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  async init() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Parse een Vinted zoek URL om de parameters te extraheren
  parseVintedUrl(url) {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      return {
        search: params.get('search_text') || '',
        priceFrom: params.get('price_from') || null,
        priceTo: params.get('price_to') || null,
        brand: params.get('brand_id') || null,
        size: params.get('size_id') || null,
        category: params.get('catalog_id') || null,
        material: params.get('material_id') || null,
        color: params.get('color_id') || null,
        status: params.get('status_id') || null
      };
    } catch (error) {
      console.error('Error parsing Vinted URL:', error);
      return null;
    }
  }

  // Bouw een Vinted zoek URL op basis van parameters
  buildVintedUrl(params) {
    const baseUrl = `${config.vinted.baseUrl}/vetements`;
    const searchParams = new URLSearchParams();

    if (params.search) searchParams.set('search_text', params.search);
    if (params.priceFrom) searchParams.set('price_from', params.priceFrom);
    if (params.priceTo) searchParams.set('price_to', params.priceTo);
    if (params.brand) searchParams.set('brand_id', params.brand);
    if (params.size) searchParams.set('size_id', params.size);
    if (params.category) searchParams.set('catalog_id', params.category);
    if (params.material) searchParams.set('material_id', params.material);
    if (params.color) searchParams.set('color_id', params.color);
    if (params.status) searchParams.set('status_id', params.status);

    // Sorteer op nieuwste items
    searchParams.set('order', 'newest_first');

    return `${baseUrl}?${searchParams.toString()}`;
  }

  // Haal items op van een Vinted zoekpagina
  async scrapeSearchResults(url, maxItems = 20) {
    await this.init();
    
    try {
      const page = await this.browser.newPage();
      
      // Set user agent en viewport
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });

      // Accepteer cookies automatisch
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('cookie_policy_accepted', 'true');
      });

      console.log(`Scraping: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wacht tot items geladen zijn
      await page.waitForSelector('[data-testid="feed-grid"]', { timeout: 10000 });

      // Extract items data
      const items = await page.evaluate((maxItems) => {
        const itemElements = document.querySelectorAll('[data-testid="feed-grid"] > div');
        const items = [];

        for (let i = 0; i < Math.min(itemElements.length, maxItems); i++) {
          const element = itemElements[i];
          
          try {
            // Link naar het item
            const linkElement = element.querySelector('a[href*="/items/"]');
            if (!linkElement) continue;
            
            const href = linkElement.getAttribute('href');
            const itemUrl = href.startsWith('http') ? href : `https://www.vinted.nl${href}`;
            
            // Vinted ID uit URL
            const vintedIdMatch = href.match(/\/items\/(\d+)/);
            if (!vintedIdMatch) continue;
            const vintedId = vintedIdMatch[1];

            // Titel
            const titleElement = element.querySelector('[data-testid="item-title"]');
            const title = titleElement ? titleElement.textContent.trim() : 'Geen titel';

            // Prijs
            const priceElement = element.querySelector('[data-testid="item-price"]');
            let price = 0;
            let currency = 'EUR';
            if (priceElement) {
              const priceText = priceElement.textContent.trim();
              const priceMatch = priceText.match(/([\d,\.]+)\s*€?/);
              if (priceMatch) {
                price = parseFloat(priceMatch[1].replace(',', '.'));
              }
            }

            // Afbeelding
            const imgElement = element.querySelector('img');
            const imageUrl = imgElement ? imgElement.getAttribute('src') : null;

            // Verkoper (indien beschikbaar)
            const sellerElement = element.querySelector('[data-testid="item-seller"]');
            const sellerName = sellerElement ? sellerElement.textContent.trim() : null;

            // Maat (indien beschikbaar)
            const sizeElement = element.querySelector('[data-testid="item-size"]');
            const size = sizeElement ? sizeElement.textContent.trim() : null;

            // Brand (probeer uit titel te halen)
            const brand = null; // Dit kan later verbeterd worden

            items.push({
              vintedId,
              title,
              price,
              currency,
              size,
              brand,
              condition: null, // Kan later toegevoegd worden
              url: itemUrl,
              imageUrl,
              sellerName,
              location: null // Kan later toegevoegd worden
            });

          } catch (error) {
            console.error('Error parsing item:', error);
            continue;
          }
        }

        return items;
      }, maxItems);

      await page.close();
      console.log(`Found ${items.length} items`);
      return items;

    } catch (error) {
      console.error('Error scraping Vinted:', error);
      return [];
    }
  }

  // Haal gedetailleerde informatie op van een specifiek item
  async scrapeItemDetails(itemUrl) {
    await this.init();
    
    try {
      const page = await this.browser.newPage();
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(itemUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      const itemDetails = await page.evaluate(() => {
        const result = {};

        // Titel
        const titleElement = document.querySelector('[data-testid="item-title"]') || 
                           document.querySelector('h1');
        if (titleElement) {
          result.title = titleElement.textContent.trim();
        }

        // Prijs
        const priceElement = document.querySelector('[data-testid="item-price"]') ||
                           document.querySelector('.item-price');
        if (priceElement) {
          const priceText = priceElement.textContent.trim();
          const priceMatch = priceText.match(/([\d,\.]+)/);
          if (priceMatch) {
            result.price = parseFloat(priceMatch[1].replace(',', '.'));
          }
        }

        // Verkoper informatie
        const sellerElement = document.querySelector('[data-testid="seller-name"]') ||
                            document.querySelector('.user-login');
        if (sellerElement) {
          result.sellerName = sellerElement.textContent.trim();
        }

        // Item details (maat, merk, staat, etc.)
        const detailElements = document.querySelectorAll('[data-testid="item-details"] div, .item-attributes div');
        detailElements.forEach(element => {
          const text = element.textContent.trim();
          if (text.includes('Maat:') || text.includes('Size:')) {
            result.size = text.split(':')[1]?.trim();
          }
          if (text.includes('Merk:') || text.includes('Brand:')) {
            result.brand = text.split(':')[1]?.trim();
          }
          if (text.includes('Staat:') || text.includes('Condition:')) {
            result.condition = text.split(':')[1]?.trim();
          }
        });

        return result;
      });

      await page.close();
      return itemDetails;

    } catch (error) {
      console.error('Error scraping item details:', error);
      return {};
    }
  }

  // Test functie om te controleren of Vinted bereikbaar is
  async testConnection() {
    try {
      const response = await axios.get(config.vinted.baseUrl, {
        headers: {
          'User-Agent': this.userAgent
        },
        timeout: 10000
      });
      
      return response.status === 200;
    } catch (error) {
      console.error('Vinted connection test failed:', error.message);
      return false;
    }
  }

  // Maak een zoekquery op basis van tekst input
  createSearchFromText(searchText) {
    const params = {
      search: searchText,
      order: 'newest_first'
    };

    // Probeer prijs range te detecteren
    const priceMatch = searchText.match(/(\d+)-(\d+)\s*€?/);
    if (priceMatch) {
      params.priceFrom = priceMatch[1];
      params.priceTo = priceMatch[2];
      params.search = searchText.replace(priceMatch[0], '').trim();
    }

    return this.buildVintedUrl(params);
  }
}

module.exports = VintedScraper;