/**
 * Test Script: Scrape comments for a single idea
 */

const { chromium } = require('playwright');
const Database = require('better-sqlite3');

async function scrapeComments(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`[Test] Scraping comments from: ${url}`);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("h1", { timeout: 5000 });

    // Extract comments
    const commentsData = await page.evaluate(() => {
      const commentsList = [];

      // Finde alle H2 Überschriften und suche nach "Kommentare"
      const headings = Array.from(document.querySelectorAll('h2'));
      const commentsHeading = headings.find(h => h.textContent?.includes('Kommentare'));

      if (commentsHeading) {
        // Gehe zum parent und finde alle article Elemente
        let parent = commentsHeading.parentElement;
        while (parent && !parent.querySelectorAll('article').length) {
          parent = parent.parentElement;
        }

        if (parent) {
          const commentArticles = parent.querySelectorAll('article');

          commentArticles.forEach(article => {
            try {
              // Autor und Datum extrahieren
              const allText = article.textContent || '';
              const authorMatch = allText.match(/Gespeichert von\s+(.+?)\s+am/);
              const author = authorMatch ? authorMatch[1].trim() : 'Anonym';

              // Datum extrahieren
              const dateMatch = allText.match(/am\s+(.+?)Permalink/);
              const date = dateMatch ? dateMatch[1].trim() : '';

              // Finde das h3 Element (Kommentar-Titel) und das folgende p Element (Kommentar-Text)
              const h3 = article.querySelector('h3');
              const paragraph = article.querySelector('p');
              const text = paragraph?.textContent?.trim() || '';

              if (text && text.length > 3) {
                commentsList.push({ author, text, date });
              }
            } catch (e) {
              console.error('Error parsing comment:', e);
            }
          });
        }
      }

      return commentsList;
    });

    console.log(`[Test] Found ${commentsData.length} comments`);

    if (commentsData.length > 0) {
      console.log(`[Test] First comment:`);
      console.log(`  Author: ${commentsData[0].author}`);
      console.log(`  Text: ${commentsData[0].text.substring(0, 100)}...`);
      console.log(`  Date: ${commentsData[0].date}`);
    }

    await browser.close();
    return commentsData;

  } catch (error) {
    console.error(`[Test] Error scraping comments:`, error.message);
    await browser.close();
    return [];
  }
}

async function main() {
  const ideaId = 771;
  const url = "https://mitreden.braunschweig.de/node/4917";

  // Scrape comments
  const comments = await scrapeComments(url);

  if (comments.length === 0) {
    console.log('[Test] ❌ No comments found - scraping might need adjustment');
    return;
  }

  // Update database
  const db = new Database('./data/bohlweg.db');
  const commentsJson = JSON.stringify(comments);

  const stmt = db.prepare('UPDATE ideas SET commentsData = ? WHERE id = ?');
  const result = stmt.run(commentsJson, ideaId);

  console.log(`[Test] ✓ Updated database: ${result.changes} row(s) affected`);
  console.log(`[Test] ✓ Stored ${comments.length} comments for idea ${ideaId}`);

  db.close();
}

main().catch(console.error);
