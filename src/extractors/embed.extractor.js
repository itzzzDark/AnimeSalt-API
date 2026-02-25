/**
 * Embed Page Extractor
 * Copyright (c) 2025 Basirul Akhlak Borno - https://basirulakhlak.tech/
 * ⚠️ Educational use only. Respect copyright laws.
 */

const { BaseExtractor } = require('./base.extractor');
const { WatchAnimeWorldBase } = require('../base/base');

class EmbedExtractor extends BaseExtractor {
  constructor() {
    super();
    this.base = new WatchAnimeWorldBase();
  }

  getSourceName() {
    return 'watchanimeworld.net';
  }

  async extract(html, url) {
    const $ = this.loadCheerio(html);

    const servers = [];

    // Extract server information from options divs
    $('div[id^="options-"]').each((_, el) => {
      const $option = $(el);
      const optionId = $option.attr('id');
      const optionMatch = optionId.match(/options-(\d+)/);
      
      if (!optionMatch) return;

      const serverNumber = parseInt(optionMatch[1], 10);
      
      // Get iframe src (prefer src, fallback to data-src)
      const iframe = $option.find('iframe').first();
      const iframeSrc = this.extractAttribute(iframe, 'src') || this.extractAttribute(iframe, 'data-src') || '';

      // Get server name from the corresponding tab link
      const serverName = this.extractText($(`a[href="#${optionId}"] .server`).first()).trim();

      if (iframeSrc) {
        servers.push({
          server: serverNumber,
          name: serverName || `Server ${serverNumber}`,
          url: iframeSrc,
        });
      }
    });

    // Filter out servers named "play" (case insensitive)
    const filteredServers = servers.filter(server => 
      !server.name.toLowerCase().includes('play')
    );

    // Sort by server number
    filteredServers.sort((a, b) => a.server - b.server);

    return {
      id: '',
      servers: filteredServers,
    };
  }

  async getSeriesIdFromEpisodeId(episodeId) {
    // Extract series ID from episode ID (e.g., "spy-x-family-3x1" -> "spy-x-family")
    // Remove season/episode pattern like "-3x1", "-2x12", etc.
    const seriesIdMatch = episodeId.match(/^(.+?)(?:-\d+x\d+)$/);
    if (seriesIdMatch) {
      return seriesIdMatch[1];
    }
    return episodeId;
  }

  async extractFromUrl(id) {
    const { httpClient } = require('../utils/http');
    const { getRandomUserAgent } = require('../config/user-agents');
    const { logger } = require('../utils/logger');

    const episodeUrl = `${this.base.baseUrl}/episode/${id}/`;
    
    try {
      // Try episode page first
      const html = await httpClient.get(episodeUrl, {
        headers: {
          'User-Agent': getRandomUserAgent(),
        },
      });

      const data = await this.extract(html, episodeUrl);
      data.id = id;
      return data;
    } catch (error) {
      // If 404 or other error, try details page
      const is404 = error.response?.status === 404 || 
                    error.status === 404 || 
                    error.message?.includes('404') ||
                    error.code === 'ENOTFOUND';
      
      if (is404) {
        logger.info(`Episode page not found (404), trying details page for: ${id}`);
        
        const seriesId = await this.getSeriesIdFromEpisodeId(id);
        
        // Try series first, then movies
        const detailUrls = [
          `${this.base.baseUrl}/series/${seriesId}/`,
          `${this.base.baseUrl}/movies/${seriesId}/`,
        ];

        let lastDetailError;
        for (const detailUrl of detailUrls) {
          try {
            const detailHtml = await httpClient.get(detailUrl, {
              headers: {
                'User-Agent': getRandomUserAgent(),
              },
            });

            const data = await this.extract(detailHtml, detailUrl);
            data.id = id;
            return data;
          } catch (detailError) {
            lastDetailError = detailError;
            // Continue to next URL
            continue;
          }
        }
        
        // If all detail URLs failed, throw the last error
        if (lastDetailError) {
          throw lastDetailError;
        }
      }
      
      // Re-throw original error if not 404
      throw error;
    }
  }
}

module.exports = { EmbedExtractor };
