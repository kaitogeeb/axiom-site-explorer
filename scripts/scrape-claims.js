import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function scrapeClaims() {
  console.log('Starting scraper...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Enable request interception to find API calls
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
        console.log('XHR/Fetch Request:', request.url());
      }
      request.continue();
    });

    console.log('Navigating to claimyoursol.com...');
    await page.goto('https://claimyoursol.com/', { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for some content to load
    await page.waitForSelector('body');

    // Click load more once to trigger a request
    console.log('Clicking Load More to identify API...');
    try {
        const loadMoreButton = await page.evaluateHandle(() => {
          const elements = Array.from(document.querySelectorAll('button, a, div, span, td'));
          return elements.find(el => el.textContent.trim().toLowerCase() === 'load more');
        });
        if (loadMoreButton && loadMoreButton.asElement()) {
            await loadMoreButton.asElement().click();
            await new Promise(r => setTimeout(r, 3000)); // Wait for request
        }
    } catch (e) {
        console.log('Error clicking load more for test:', e);
    }
    
    // Try to find stats
    const data = await page.evaluate(() => {
      // Helper to find text
      const findText = (text) => {
        const elements = Array.from(document.querySelectorAll('*'));
        return elements.find(el => el.textContent.includes(text));
      };

      // Extract Stats
      const stats = {
        totalRecovered: '0 SOL',
        totalAccounts: '0',
        ledger: []
      };

      // Try to find "Total SOL Recovered" or similar
      const bodyText = document.body.innerText;
      
      // Simple regex extraction as fallback
      const recoveredMatch = bodyText.match(/Total SOL Recovered\s*([\d.,]+)/i);
      if (recoveredMatch) stats.totalRecovered = recoveredMatch[1];

      const accountsMatch = bodyText.match(/Total Accounts Claimed\s*([\d.,]+)/i);
      if (accountsMatch) stats.totalAccounts = accountsMatch[1];

      // Try to find the ledger table
      // Look for table rows
      const rows = Array.from(document.querySelectorAll('tr'));
      if (rows.length > 0) {
        stats.ledger = rows.slice(1).map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          const dateText = cells[3]?.textContent?.trim() || new Date().toISOString().split('T')[0];
          // Fix date format if needed (e.g. insert space before time)
          const formattedDate = dateText.replace(/(\d{4}-\d{2}-\d{2})(\d{2}:\d{2})/, '$1 $2');
          
          // Extract wallet link and text
          const walletCell = cells[0];
          const walletAnchor = walletCell?.querySelector('a');
          const walletLink = walletAnchor?.href || '';
          
          // Try to separate Wallet and TX
          // Assuming structure is something like: Text(Wallet) ... Anchor(TX)
          const fullText = walletCell?.innerText?.trim() || walletCell?.textContent?.trim() || ''; // innerText preserves newlines often
          const txText = walletAnchor?.textContent?.trim() || '';
          
          let walletText = fullText;
          // If we can identify the TX text inside the full text, remove it to get the Wallet text
          if (txText && walletText.includes(txText)) {
             walletText = walletText.replace(txText, '').trim();
          }
          
          // Clean up if there are leftover newlines or spaces
          walletText = walletText.replace(/\n/g, ' ').trim();

          return {
            wallet: walletText,
            tx: txText,
            walletLink: walletLink,
            accts: cells[1]?.textContent?.trim() || '',
            claimed: cells[2]?.textContent?.trim() || '',
            date: formattedDate
          };
        }).filter(row => row.wallet && !row.wallet.toUpperCase().includes('LOAD MORE'));
      }

      return stats;
    });

    console.log('Extracted data:', data);

    // Ensure public directory exists
    const publicDir = path.join(__dirname, '../public/data');
    if (!fs.existsSync(publicDir)){
        fs.mkdirSync(publicDir, { recursive: true });
    }

    // Save to file
    fs.writeFileSync(
      path.join(publicDir, 'claims.json'),
      JSON.stringify(data, null, 2)
    );
    
    console.log('Data saved to public/data/claims.json');

  } catch (error) {
    console.error('Scraping failed:', error);
  } finally {
    await browser.close();
  }
}

// Run if called directly
if (process.argv[1] === __filename) {
  scrapeClaims();
}

export { scrapeClaims };
