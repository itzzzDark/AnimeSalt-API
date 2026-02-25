/**
 * Type Page Extractor (movies, series, anime, cartoon)
 * Copyright (c) 2025 Basirul Akhlak Borno - https://basirulakhlak.tech/
 * ⚠️ Educational use only. Respect copyright laws.
 */

const { BaseExtractor } = require('./base.extractor');
const { WatchAnimeWorldBase } = require('../base/base');

class TypeExtractor extends BaseExtractor {
  constructor() {
    super();
    this.base = new WatchAnimeWorldBase();
  }

  getSourceName() {
    return 'watchanimeworld.net';
  }

  extractItem($, item) {
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

  extractPagination($, currentPage = 1) {
    const pagination = {
      currentPage: currentPage,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
      nextUrl: null,
      prevUrl: null,
    };

    const paginationEl = $('.navigation.pagination').first();
    if (paginationEl.length) {
      // Use the passed currentPage parameter (from query string)
      // Don't override with HTML value since we're using static HTML files

      // Get next page
      const navLinks = paginationEl.find('.nav-links');
      navLinks.find('a').each((_, el) => {
        const text = this.extractText($(el)).trim().toUpperCase();
        const href = this.extractAttribute($(el), 'href');
        if (text === 'NEXT' && href && !href.includes('javascript:')) {
          pagination.hasNext = true;
          pagination.nextUrl = this.base.buildUrl(href);
        }
      });

      // Get previous page (if exists)
      const prevLink = navLinks.find('a').filter((_, el) => {
        const text = this.extractText($(el));
        return text.trim().toUpperCase() === 'PREV' || text.trim().toUpperCase() === 'PREVIOUS';
      }).first();
      
      if (prevLink.length) {
        pagination.hasPrev = true;
        const href = this.extractAttribute(prevLink, 'href');
        if (href && !href.includes('javascript:')) {
          pagination.prevUrl = this.base.buildUrl(href);
        }
      }

      // Get total pages from page links
      const pageLinks = navLinks.find('.page-link');
      let maxPage = pagination.currentPage;
      pageLinks.each((_, el) => {
        const pageText = this.extractText($(el));
        const pageNum = parseInt(pageText);
        if (pageNum && pageNum > maxPage) {
          maxPage = pageNum;
        }
      });
      pagination.totalPages = maxPage || pagination.currentPage;
    }

    return pagination;
  }

  async extract(html, url, currentPage = 1) {
    const $ = this.loadCheerio(html);

    const items = [];
    
    // Extract items from post list - only select li to avoid duplicates
    $('.post-lst > li').each((_, el) => {
      const item = this.extractItem($, $(el));
      if (item.title) {
        items.push(item);
      }
    });

    // Extract pagination
    const pagination = this.extractPagination($, currentPage);

    return {
      items,
      pagination,
    };
  }

  async extractFromFile(filePath, type = 'movies', page = 1, pathType = 'category') {
    // Build URL - supports category, letter, and direct paths
    // pathType can be 'category', 'letter', or 'direct'
    // Examples:
    // - category: /category/language/english/ or /category/genre/sci-fi/
    // - category (nested - network): /category/network/cartoon-network/, /category/network/disney/, /category/network/nickelodeon/, etc.
    // - category (nested - franchise): /category/franchise/pokemon/, /category/franchise/naruto/, /category/franchise/dragon-ball/, etc.
    // - letter: /letter/D/ or /letter/D/page/2/
    // - direct: /movies/ or /series/
    // Note: Supports unlimited network and franchise names dynamically
    const { httpClient } = require('../utils/http');
    const { getRandomUserAgent } = require('../config/user-agents');
    const { logger } = require('../utils/logger');

    // Known direct paths (not categories)
    const directPaths = ['movies', 'series'];
    
    let url;
    let html;
    let lastError;

    // Handle letter paths (e.g., /letter/D/)
    if (pathType === 'letter') {
      url = `${this.base.baseUrl}/letter/${type}${page > 1 ? `/page/${page}/` : '/'}`;
      try {
        html = await httpClient.get(url, {
          headers: {
            'User-Agent': getRandomUserAgent(),
          },
        });
        return this.extract(html, url, page);
      } catch (error) {
        throw error;
      }
    }

    // Try category path first (unless it's a known direct path)
    // Supports nested paths like: network/cartoon-network, franchise/pokemon
    if (!directPaths.includes(type)) {
      // Normalize the type path (remove leading/trailing slashes, ensure proper format)
      const normalizedType = type.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
      url = `${this.base.baseUrl}/category/${normalizedType}${page > 1 ? `/page/${page}/` : '/'}`;
      try {
        html = await httpClient.get(url, {
          headers: {
            'User-Agent': getRandomUserAgent(),
          },
        });
        return this.extract(html, url, page);
      } catch (error) {
        lastError = error;
        logger.debug(`Category path failed for ${type}, trying direct path`);
      }
    }

    // Try direct path
    url = `${this.base.baseUrl}/${type}${page > 1 ? `/page/${page}/` : '/'}`;
    try {
      html = await httpClient.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
        },
      });
      return this.extract(html, url, page);
    } catch (error) {
      // If both failed, throw the last error
      throw lastError || error;
    }
  }
}

module.exports = { TypeExtractor };
