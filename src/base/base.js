/**
 * Base Scraper for WatchAnimeWorld.net
 * Copyright (c) 2025 Basirul Akhlak Borno - https://github.com/basirulakhlakborno
 * ⚠️ Educational use only. Respect copyright laws.
 */

class WatchAnimeWorldBase {
  constructor() {
    this.baseUrl = 'https://toonstream.dad';
  }

  buildUrl(path) {
    if (path.startsWith('http')) return path;
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }
}

module.exports = { WatchAnimeWorldBase };
