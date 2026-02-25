/**
 * Episodes Page Extractor
 * Copyright (c) 2025 Basirul Akhlak Borno - https://basirulakhlak.tech/
 * ⚠️ Educational use only. Respect copyright laws.
 */

const { BaseExtractor } = require('./base.extractor');
const { WatchAnimeWorldBase } = require('../base/base');

class EpisodesExtractor extends BaseExtractor {
  constructor() {
    super();
    this.base = new WatchAnimeWorldBase();
  }

  getSourceName() {
    return 'watchanimeworld.net';
  }

  extractEpisode($, item) {
    const episodeNum = this.extractText($(item).find('.num-epi').first());
    const title = this.extractText($(item).find('.entry-title').first());
    const image = this.extractAttribute($(item).find('img').first(), 'src');
    const link = this.extractAttribute($(item).find('a.lnk-blk').first(), 'href');

    let episodeId = '';
    if (link) {
      const fullUrl = this.base.buildUrl(link);
      const urlParts = fullUrl.split('/').filter(part => part);
      episodeId = urlParts[urlParts.length - 1] || '';
    }

    // Parse season and episode from format like "2x1" or "S2E1"
    let season = '';
    let episode = '';
    if (episodeNum) {
      const match = episodeNum.match(/(\d+)[xX](\d+)/);
      if (match) {
        season = match[1];
        episode = match[2];
      } else {
        // Try alternative format like "S2E1"
        const altMatch = episodeNum.match(/[sS](\d+)[eE](\d+)/);
        if (altMatch) {
          season = altMatch[1];
          episode = altMatch[2];
        }
      }
    }

    return {
      id: episodeId,
      season: season || '',
      episode: episode || '',
      title: title || '',
      image: this.normalizeImageUrl(image),
    };
  }

  async extract(html) {
    const $ = this.loadCheerio(html);

    const episodes = [];
    $('li').each((_, el) => {
      const episode = this.extractEpisode($, $(el));
      if (episode.title) {
        episodes.push(episode);
      }
    });

    return episodes;
  }

  async getPostId(id) {
    // Try series first, then movies
    const { httpClient } = require('../utils/http');
    const { getRandomUserAgent } = require('../config/user-agents');

    const urls = [
      `${this.base.baseUrl}/series/${id}/`,
      `${this.base.baseUrl}/movies/${id}/`,
    ];

    let lastError;
    for (const url of urls) {
      try {
        const html = await httpClient.get(url, {
          headers: {
            'User-Agent': getRandomUserAgent(),
          },
        });

        const $ = this.loadCheerio(html);
        const bodyClass = $('body').attr('class') || '';
        const postIdMatch = bodyClass.match(/postid-(\d+)/);
        if (postIdMatch) {
          return postIdMatch[1];
        }
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    throw lastError || new Error(`Failed to fetch post ID for ID: ${id}`);
  }

  async extractFromAjax(id, season) {
    const { httpClient } = require('../utils/http');
    const { getRandomUserAgent } = require('../config/user-agents');

    // First get the post ID
    const postId = await this.getPostId(id);

    // Then fetch episodes from AJAX endpoint
    const ajaxUrl = `${this.base.baseUrl}/wp-admin/admin-ajax.php?action=action_select_season&season=${season}&post=${postId}`;
    const html = await httpClient.get(ajaxUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `${this.base.baseUrl}/series/${id}/`,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const episodes = await this.extract(html);

    return {
      postId: postId,
      episodes: episodes,
    };
  }
}

module.exports = { EpisodesExtractor };
