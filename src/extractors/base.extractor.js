const cheerio = require('cheerio');
const { httpClient } = require('../utils/http');
const { logger } = require('../utils/logger');
const { ScraperError } = require('../utils/errors');

class BaseExtractor {
  async scrape(url, options) {
    try {
      logger.info(`Scraping URL: ${url}`);
      const html = await httpClient.get(url, options);
      const data = await this.extract(html, url);

      return {
        data,
        metadata: {
          url,
          extractedAt: new Date().toISOString(),
          source: this.getSourceName(),
        },
      };
    } catch (error) {
      logger.error(`Failed to scrape ${url}`, error);
      throw new ScraperError(
        `Failed to scrape ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  loadCheerio(html) {
    return cheerio.load(html);
  }

  sanitizeText(text) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
  }

  extractAttribute(element, attribute) {
    return element?.attr(attribute)?.trim() || '';
  }

  extractText(element) {
    return this.sanitizeText(element?.text());
  }

  normalizeImageUrl(imageUrl) {
    if (!imageUrl) return '';
    
    // Handle protocol-relative URLs
    if (imageUrl.startsWith('//')) {
      imageUrl = `https:${imageUrl}`;
    }
    
    // Replace img.anime-world.co with img.watchanimeworld.net
    imageUrl = imageUrl.replace(/img\.anime-world\.co/g, 'img.watchanimeworld.net');
    
    return imageUrl;
  }
}

module.exports = { BaseExtractor };
