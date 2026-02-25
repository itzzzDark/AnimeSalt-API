#!/usr/bin/env node

/**
 * Simple Node.js API Test Script
 * Tests all endpoints of the AniBiee API
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

class APITester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  log(message, status = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${status}] ${message}`);
  }

  async makeRequest(url, method = 'GET', expectedStatus = 200) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.request(url, { method }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = {
              status: res.statusCode,
              headers: res.headers,
              data: data ? JSON.parse(data) : null
            };
            resolve(result);
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: data
            });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  async testEndpoint(name, url, expectedStatus = 200, validator = null, method = 'GET') {
    try {
      this.log(`Testing ${name}: ${url}`);
      const result = await this.makeRequest(url, method, expectedStatus);

      if (expectedStatus === null || result.status === expectedStatus) {
        if (validator && !validator(result)) {
          this.failed++;
          this.log(`${name} - FAILED: Validation failed`, 'ERROR');
          return false;
        }
        this.passed++;
        this.log(`${name} - PASSED (${result.status})`, 'SUCCESS');
        return true;
      } else {
        this.failed++;
        this.log(`${name} - FAILED: Expected ${expectedStatus}, got ${result.status}`, 'ERROR');
        return false;
      }
    } catch (error) {
      this.failed++;
      this.log(`${name} - FAILED: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async runTests() {
    this.log('🚀 Starting API Tests...', 'START');

    // Test 1: Health Check
    await this.testEndpoint('Health Check', `${API_BASE}/health`, 200, (res) => {
      return res.data && res.data.success === true && res.data.timestamp;
    });

    // Test 2: Home Page
    await this.testEndpoint('Home Page', `${API_BASE}/home`, 200, (res) => {
      return res.data && res.data.success === true && res.data.data;
    });

    // Test 3: Search API (with query) - Get valid ID for later tests
    let validAnimeId = null;
    const searchSuccess = await this.testEndpoint('Search with Query', `${API_BASE}/search?q=naruto`, 200, (res) => {
      if (res.data && res.data.success === true && res.data.data) {
        // Try to extract a valid ID from search results
        try {
          const results = res.data.data;
          this.log(`Search results type: ${typeof results}, isArray: ${Array.isArray(results)}`, 'DEBUG');

          // Check if results have an items array
          let items = [];
          if (results.items && Array.isArray(results.items)) {
            items = results.items;
          } else if (Array.isArray(results)) {
            items = results;
          }

          if (items.length > 0) {
            // Look for an ID in the first result
            const firstResult = items[0];
            this.log(`First result keys: ${Object.keys(firstResult).join(', ')}`, 'DEBUG');

            if (firstResult.id) {
              validAnimeId = firstResult.id;
              this.log(`Found valid anime ID: ${validAnimeId}`, 'INFO');
              return true;
            } else {
              this.log('First result does not have id field', 'WARNING');
            }
          } else {
            this.log(`No results found in items array`, 'WARNING');
          }
        } catch (e) {
          this.log(`Could not extract ID from search results: ${e.message}`, 'WARNING');
        }
      }
      return res.data && res.data.success === true;
    });

    // Test 4: Search API (with suggestion)
    await this.testEndpoint('Search with Suggestion', `${API_BASE}/search?suggestion=naruto`, 200, (res) => {
      return res.data && res.data.success === true;
    });

    // Test 5: Search API (no params - should fail)
    await this.testEndpoint('Search without Params', `${API_BASE}/search`, 400);

    // Test 6: Category Browse
    await this.testEndpoint('Category Browse', `${API_BASE}/category/genre/action`, 200, (res) => {
      return res.data && (res.data.success === true || res.data.error);
    });

    // Test 7: Letter Browse
    await this.testEndpoint('Letter Browse', `${API_BASE}/letter/a`, 200, (res) => {
      return res.data && (res.data.success === true || res.data.error);
    });

    // Test 8: Info Endpoint - Use valid ID if available
    const infoUrl = validAnimeId ? `${API_BASE}/info/${validAnimeId}` : `${API_BASE}/info/placeholder-id`;
    await this.testEndpoint(`Info Endpoint (${validAnimeId ? 'valid ID' : 'placeholder'})`, infoUrl, validAnimeId ? 200 : 400, (res) => {
      return res.data && (res.data.success === true || res.data.error);
    });

    // Test 9: Episodes Endpoint - Use valid ID if available
    const episodesUrl = validAnimeId ? `${API_BASE}/episodes/${validAnimeId}/1` : `${API_BASE}/episodes/placeholder-id/1`;
    await this.testEndpoint(`Episodes Endpoint (${validAnimeId ? 'valid ID' : 'placeholder'})`, episodesUrl, validAnimeId ? 200 : 400, (res) => {
      return res.data && (res.data.success === true || res.data.error);
    });

    // Test 10: Embed Endpoint - Use valid ID if available
    const embedUrl = validAnimeId ? `${API_BASE}/embed/${validAnimeId}` : `${API_BASE}/embed/placeholder-id`;
    await this.testEndpoint(`Embed Endpoint (${validAnimeId ? 'valid ID' : 'placeholder'})`, embedUrl, validAnimeId ? 200 : 400, (res) => {
      return res.data && (res.data.success === true || res.data.error);
    });

    // Test 11: Scrape Endpoint (valid URL)
    await this.testEndpoint('Scrape Endpoint', `${API_BASE}/scrape?url=https://example.com`, null, (res) => {
      return res.data && (res.data.success === true || res.data.error);
    });

    // Test 12: Scrape Endpoint (invalid URL)
    await this.testEndpoint('Scrape Invalid URL', `${API_BASE}/scrape?url=invalid-url`, 400);

    // Test 13: Method Restriction (POST)
    await this.testEndpoint('Method Restriction POST', `${API_BASE}/home`, 405, null, 'POST');

    // Test 14: Method Restriction (PUT)
    await this.testEndpoint('Method Restriction PUT', `${API_BASE}/home`, 405, null, 'PUT');

    // Test 15: Method Restriction (DELETE)
    await this.testEndpoint('Method Restriction DELETE', `${API_BASE}/home`, 405, null, 'DELETE');

    this.printSummary();
  }

  async testEndpoint(name, url, expectedStatus = 200, validator = null, method = 'GET') {
    try {
      this.log(`Testing ${name}: ${url}`);
      const result = await this.makeRequest(url, method, expectedStatus);

      if (expectedStatus === null || result.status === expectedStatus) {
        if (validator && !validator(result)) {
          this.failed++;
          this.log(`${name} - FAILED: Validation failed`, 'ERROR');
          return false;
        }
        this.passed++;
        this.log(`${name} - PASSED (${result.status})`, 'SUCCESS');
        return true;
      } else {
        this.failed++;
        this.log(`${name} - FAILED: Expected ${expectedStatus}, got ${result.status}`, 'ERROR');
        return false;
      }
    } catch (error) {
      this.failed++;
      this.log(`${name} - FAILED: ${error.message}`, 'ERROR');
      return false;
    }
  }

  printSummary() {
    const total = this.passed + this.failed;
    const successRate = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;

    this.log('', 'SUMMARY');
    this.log('='.repeat(50), 'SUMMARY');
    this.log(`Total Tests: ${total}`, 'SUMMARY');
    this.log(`Passed: ${this.passed}`, 'SUCCESS');
    this.log(`Failed: ${this.failed}`, this.failed > 0 ? 'ERROR' : 'SUCCESS');
    this.log(`Success Rate: ${successRate}%`, 'SUMMARY');
    this.log('='.repeat(50), 'SUMMARY');

    if (this.failed === 0) {
      this.log('🎉 All tests passed!', 'SUCCESS');
    } else {
      this.log('⚠️  Some tests failed. Check the logs above.', 'WARNING');
    }
  }
}

// Check if server is running
async function checkServer() {
  try {
    await new Promise((resolve, reject) => {
      const req = http.request(`${BASE_URL}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Server responded with ${res.statusCode}`));
        }
      });

      req.on('error', () => {
        reject(new Error('Server not running. Please start with: npm run dev'));
      });

      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Server connection timeout'));
      });

      req.end();
    });
    return true;
  } catch (error) {
    console.error('❌ Server check failed:', error.message);
    console.log('💡 Make sure the server is running with: npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🧪 AniBiee API Test Script');
  console.log('==========================\n');

  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }

  const tester = new APITester();
  await tester.runTests();
}

// Run the tests
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Test script failed:', error);
    process.exit(1);
  });
}

module.exports = APITester;