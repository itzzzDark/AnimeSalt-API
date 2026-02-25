/**
 * Details Page Extractor
 * Copyright (c) 2025 Basirul Akhlak Borno - https://basirulakhlak.tech/
 * ⚠️ Educational use only. Respect copyright laws.
 */

const { BaseExtractor } = require('./base.extractor');
const { WatchAnimeWorldBase } = require('../base/base');

class DetailsExtractor extends BaseExtractor {
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

    // Parse season and episode from format like "3x1" or "S3E1"
    let season = '';
    let episode = '';
    if (episodeNum) {
      const match = episodeNum.match(/(\d+)[xX](\d+)/);
      if (match) {
        season = match[1];
        episode = match[2];
      } else {
        // Try alternative format like "S3E1"
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

  extractRecommended($) {
    const recommended = [];
    $('.owl-carousel .post').each((_, el) => {
      const title = this.extractText($(el).find('.entry-title').first());
      const image = this.extractAttribute($(el).find('img').first(), 'src');
      const link = this.extractAttribute($(el).find('a.lnk-blk').first(), 'href');
      const year = this.extractText($(el).find('.year').first());

      let id = '';
      let type = '';
      if (link) {
        const fullUrl = this.base.buildUrl(link);
        const urlParts = fullUrl.split('/').filter(part => part);
        id = urlParts[urlParts.length - 1] || '';

        if (fullUrl.includes('/series/')) {
          type = 'series';
        } else if (fullUrl.includes('/movies/') || fullUrl.includes('/movie/')) {
          type = 'movie';
        } else {
          type = 'unknown';
        }
      }

      if (title) {
        recommended.push({
          id: id || '',
          type: type || '',
          title: title || '',
          image: this.normalizeImageUrl(image),
          year: year || '',
        });
      }
    });

    return recommended;
  }

  async extract(html, url) {
    const $ = this.loadCheerio(html);

    // Extract title
    const title = this.extractText($('h1.entry-title').first());

    // Extract image
    const image = this.extractAttribute($('article.post.single img').first(), 'src');
    const imageUrl = this.normalizeImageUrl(image);

    // Extract background image (from header or footer background)
    let backgroundImage = '';
    const bgHeaderImg = this.extractAttribute($('.bghd img.TPostBg').first(), 'src');
    const bgFooterImg = this.extractAttribute($('.bgft img.TPostBg').first(), 'src');
    const bgImage = bgHeaderImg || bgFooterImg;
    if (bgImage) {
      // Normalize protocol-relative URLs (//image.tmdb.org -> https://image.tmdb.org)
      backgroundImage = bgImage.startsWith('//') ? `https:${bgImage}` : bgImage;
    }

    // Extract seasons and episodes count
    const seasonsEpisodesText = this.extractText($('article.post.single div[style*="text-align: center"]').first());
    let seasonsText = '';
    let episodesText = '';
    
    if (seasonsEpisodesText) {
      const seasonsMatch = seasonsEpisodesText.match(/(\d+)\s*Seasons?/i);
      const episodesMatch = seasonsEpisodesText.match(/(\d+)\s*Episodes?/i);
      seasonsText = seasonsMatch ? seasonsMatch[1] : '';
      episodesText = episodesMatch ? episodesMatch[1] : '';
    }

    // Extract season list from dropdown menu
    // Try multiple selectors to handle different HTML structures
    const seasonsList = [];
    const seasonSelectors = [
      '.aa-cnt.sub-menu a[data-season]',
      '.aa-drp.choose-season .aa-cnt.sub-menu a[data-season]',
      '.choose-season .sub-menu a[data-season]',
      '.aa-cnt.sub-menu li a[data-season]',
      'ul.aa-cnt.sub-menu a[data-season]',
      '.aa-drp .sub-menu a[data-season]',
      'li.sel-temp a[data-season]',
      '.aa-drp.choose-season li.sel-temp a[data-season]',
    ];
    
    let foundSeasons = false;
    for (const selector of seasonSelectors) {
      const seasonElements = $(selector);
      if (seasonElements.length > 0) {
        seasonElements.each((_, el) => {
          const seasonNum = this.extractAttribute($(el), 'data-season');
          if (seasonNum) {
            const num = parseInt(seasonNum, 10);
            if (!isNaN(num) && !seasonsList.includes(num)) {
              seasonsList.push(num);
            }
          }
        });
        if (seasonsList.length > 0) {
          foundSeasons = true;
          break;
        }
      }
    }
    
    // If no seasons found from dropdown, try to extract from button's current season display
    if (seasonsList.length === 0) {
      const currentSeasonText = this.extractText($('.aa-drp.choose-season dt.n_s').first());
      if (currentSeasonText) {
        const currentSeasonNum = parseInt(currentSeasonText, 10);
        if (!isNaN(currentSeasonNum)) {
          seasonsList.push(currentSeasonNum);
        }
      }
    }
    
    // Sort seasons numerically
    seasonsList.sort((a, b) => a - b);

    // Extract description
    const description = this.extractText($('.description').first());

    // Extract genres
    const genres = [];
    $('.genres a').each((_, el) => {
      const genre = this.extractText($(el));
      if (genre) genres.push(genre);
    });

    // Extract languages
    const languages = [];
    $('.loadactor a').each((_, el) => {
      const language = this.extractText($(el));
      if (language) languages.push(language);
    });

    // Extract duration
    const duration = this.extractText($('.duration .overviewCss').first());

    // Extract year
    const year = this.extractText($('.year .overviewCss').first());

    // Extract episodes
    const episodes = [];
    $('#episode_by_temp li').each((_, el) => {
      const episode = this.extractEpisode($, $(el));
      if (episode.title) {
        episodes.push(episode);
      }
    });

    // Extract recommended series
    const recommended = this.extractRecommended($);

    // Determine type from URL
    let type = 'unknown';
    if (url.includes('/series/')) {
      type = 'series';
    } else if (url.includes('/movies/') || url.includes('/movie/')) {
      type = 'movie';
    }

    // Extract post ID from body tag class (format: postid-1101)
    let postId = '';
    const bodyClass = $('body').attr('class') || '';
    const postIdMatch = bodyClass.match(/postid-(\d+)/);
    if (postIdMatch) {
      postId = postIdMatch[1];
    }

    const result = {
      id: '',
      type: type,
      postId: postId,
      title: title || '',
      image: imageUrl,
      background: backgroundImage || '',
      description: description || '',
      genres: genres,
      languages: languages,
      duration: duration || '',
      year: year || '',
      recommended: recommended,
    };

    // Only exclude seasons, episodes, and episodesList for movies
    if (type !== 'movie') {
      // Use seasonsList to match client expectation
      result.seasonsList = seasonsList.length > 0 ? seasonsList : (seasonsText ? [parseInt(seasonsText, 10)] : []);
      result.seasons = result.seasonsList; // Also include seasons for backward compatibility
      result.episodes = episodesText || '';
      result.episodesList = episodes;
    }

    return result;
  }

  async extractFromUrl(id) {
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

        const data = await this.extract(html, url);
        // Extract ID from URL
        const urlParts = url.split('/').filter(part => part);
        data.id = urlParts[urlParts.length - 1] || id;
        return data;
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    throw lastError || new Error(`Failed to fetch details for ID: ${id}`);
  }
}

module.exports = { DetailsExtractor };
