/**
 * Search Extractor
 * Copyright (c) 2025 Basirul Akhlak Borno - https://basirulakhlak.tech/
 * ⚠️ Educational use only. Respect copyright laws.
 */

const { BaseExtractor } = require('./base.extractor');
const { WatchAnimeWorldBase } = require('../base/base');

class SearchExtractor extends BaseExtractor {
  constructor() {
    super();
    this.base = new WatchAnimeWorldBase();
  }

  getSourceName() {
    return 'watchanimeworld.net';
  }

  /**
   * Extract nonce from homepage script tag
   */
  async getNonce() {
    const { httpClient } = require('../utils/http');
    const { getRandomUserAgent } = require('../config/user-agents');

    const html = await httpClient.get(this.base.baseUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
      },
    });

    const $ = this.loadCheerio(html);
    
    // Find the script tag with id="funciones_public_js-js-extra"
    const scriptContent = $('#funciones_public_js-js-extra').html();
    if (!scriptContent) {
      throw new Error('Nonce script tag not found');
    }

    // Extract nonce from: var torofilm_Public = {"url":"...","nonce":"6601f641c9",...}
    const nonceMatch = scriptContent.match(/"nonce"\s*:\s*"([^"]+)"/);
    if (!nonceMatch) {
      throw new Error('Nonce not found in script tag');
    }

    return nonceMatch[1];
  }

  /**
   * Extract search result item from simple list format
   */
  extractSearchItem($, item) {
    // Skip items with class "title"
    const itemClass = $(item).attr('class') || '';
    if (itemClass.includes('title')) {
      return null;
    }

    // Extract link and title
    const linkEl = $(item).find('a').first();
    const link = this.extractAttribute(linkEl, 'href');
    const linkId = linkEl.attr('id') || '';
    
    // Skip if no link or if it's the "More results" button
    if (!link || link === 'javascript:void(0)' || linkId === 'more-shm') {
      return null;
    }

    // Extract type from span (type-series, type-movie, etc.)
    const typeSpan = linkEl.find('span[class^="type-"]').first();
    let type = '';
    if (typeSpan.length) {
      const typeClass = typeSpan.attr('class') || '';
      if (typeClass.includes('type-series')) {
        type = 'series';
      } else if (typeClass.includes('type-movie')) {
        type = 'movie';
      } else {
        type = 'unknown';
      }
    }

    // Extract title (text after the span)
    const title = linkEl.clone().children().remove().end().text().trim();

    // Extract ID from URL
    const fullUrl = this.base.buildUrl(link);
    const urlParts = fullUrl.split('/').filter(part => part);
    const id = urlParts[urlParts.length - 1] || '';

    // If type not found from span, determine from URL
    if (!type) {
      if (fullUrl.includes('/series/')) {
        type = 'series';
      } else if (fullUrl.includes('/movies/') || fullUrl.includes('/movie/')) {
        type = 'movie';
      } else {
        type = 'unknown';
      }
    }

    return {
      id: id || '',
      type: type || '',
      title: title || '',
    };
  }

  /**
   * Extract search result item from full page format (post-lst)
   */
  extractFullPageItem($, item) {
    const title = this.extractText($(item).find('.entry-title').first());
    const image = this.extractAttribute($(item).find('img').first(), 'src');
    const link = this.extractAttribute($(item).find('a.lnk-blk').first(), 'href');

    // Extract ID and type from URL
    let id = '';
    let type = '';
    if (link) {
      const fullUrl = this.base.buildUrl(link);
      const urlParts = fullUrl.split('/').filter(part => part);
      id = urlParts[urlParts.length - 1] || '';
      
      // Determine type from URL
      if (fullUrl.includes('/series/')) {
        type = 'series';
      } else if (fullUrl.includes('/movies/') || fullUrl.includes('/movie/')) {
        type = 'movie';
      } else {
        type = 'unknown';
      }
    }

    return {
      id: id || '',
      type: type || '',
      title: title || '',
      image: this.normalizeImageUrl(image),
    };
  }

  /**
   * Extract search results from HTML response (AJAX format)
   */
  async extract(html) {
    const $ = this.loadCheerio(html);

    const results = [];
    
    // Extract items from list (li elements)
    $('li').each((_, el) => {
      const item = this.extractSearchItem($, $(el));
      if (item && item.title) {
        results.push(item);
      }
    });

    return results;
  }

  /**
   * Extract search results from full page HTML
   */
  async extractFullPage(html) {
    const $ = this.loadCheerio(html);

    const results = [];
    
    // Extract items from post list
    $('.post-lst li').each((_, el) => {
      const item = this.extractFullPageItem($, $(el));
      if (item.title) {
        results.push(item);
      }
    });

    return results;
  }

  /**
   * Search with suggestion term (AJAX)
   */
  async search(suggestion) {
    const { httpClient } = require('../utils/http');
    const { getRandomUserAgent } = require('../config/user-agents');

    // First get the nonce from homepage
    const nonce = await this.getNonce();

    // Then make POST request to search endpoint
    const ajaxUrl = `${this.base.baseUrl}/wp-admin/admin-ajax.php`;
    
    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('action', 'action_tr_search_suggest');
    formData.append('nonce', nonce);
    formData.append('term', suggestion);

    const html = await httpClient.post(
      ajaxUrl,
      formData.toString(),
      {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': this.base.baseUrl,
          'Referer': `${this.base.baseUrl}/`,
          'X-Requested-With': 'XMLHttpRequest',
        },
      }
    );

    const results = await this.extract(html);

    return results;
  }

  /**
   * Search with query term (full page scrape)
   */
  async searchFullPage(query) {
    const { httpClient } = require('../utils/http');
    const { getRandomUserAgent } = require('../config/user-agents');

    const url = `${this.base.baseUrl}/?s=${encodeURIComponent(query)}`;
    const html = await httpClient.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
      },
    });

    const results = await this.extractFullPage(html);

    return results;
  }
}

module.exports = { SearchExtractor };
