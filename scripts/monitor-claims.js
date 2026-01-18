import { scrapeClaims } from './scrape-claims.js';

const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function monitor() {
  console.log('Starting Claims Monitor...');
  console.log(`Update interval: ${UPDATE_INTERVAL / 1000} seconds`);

  // Run immediately
  await scrapeClaims();

  // Run periodically
  setInterval(async () => {
    console.log('Running scheduled update...');
    await scrapeClaims();
  }, UPDATE_INTERVAL);
}

monitor();
