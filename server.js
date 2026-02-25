/**
 * AnimeWorldIndia Scraper API Server
 * 
 * Copyright (c) 2025 Basirul Akhlak Borno
 * Website: https://basirulakhlak.tech/
 * 
 * ⚠️ LEGAL DISCLAIMER:
 * This API is provided for educational and research purposes only.
 * Users are responsible for ensuring their use complies with all applicable
 * copyright laws and terms of service. The developers do not endorse or
 * facilitate piracy. All content accessed through this API remains the
 * property of its respective copyright holders. Use responsibly and respect
 * intellectual property rights.
 */

const express = require('express');
const { config } = require('./src/config');
const { logger } = require('./src/utils/logger');
const { setupRouter } = require('./src/router');

const app = express();

// Setup all routes and middleware
setupRouter(app);

// Start server only if this is the main module
if (require.main === module) {
  const PORT = config.port;
  const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`API available at http://localhost:${PORT}/api`);
  });

  // Graceful shutdown
  function gracefulShutdown(signal) {
    logger.info(`${signal} signal received: closing HTTP server`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forcing server shutdown');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', reason);
    gracefulShutdown('unhandledRejection');
  });
}

module.exports = app;
