/**
 * Test script to scrape a single Mangel with status history
 */
import { chromium, Browser } from "playwright";
import { getDatabase } from "../lib/db";

async function scrapeMaengelDetailWithHistory(browser: Browser, externalId: string) {
  let context = null;
  try {
    context = await browser.newContext();
    const detailPage = await context.newPage();

    await detailPage.route('**/*.{css,woff,woff2}', route => route.abort());

    const detailUrl = `https://mitreden.braunschweig.de/node/${externalId}`;
    await detailPage.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await detailPage.waitForSelector("article", { timeout: 5000 });

    const detailData = await detailPage.evaluate(() => {
      const article = document.querySelector("article");
      if (!article) return null;

      const timeEl = article.querySelector("time");
      const createdAt = timeEl?.textContent?.trim() || "";

      const articleText = article.textContent || "";
      const authorMatch = articleText.match(/Gespeichert von\s+(\S+)\s+am/);
      const author = authorMatch?.[1] || "Anonym";

      const bodyText = document.body.textContent || "";
      const locationMatch = bodyText.match(/([A-Za-zäöüßÄÖÜ\s\-\.]+\s+\d+[a-z]?,?\s+\d{5}\s+Braunschweig)/);
      const location = locationMatch?.[1]?.trim() || "";

      const knownStatuses = ["Unbearbeitet", "in Bearbeitung", "Erledigt / beauftragt", "In der Arbeitsplanung berücksichtigt", "Keine Zuständigkeit der Stadtverwaltung", "Das Anliegen ist derzeit nicht Bestandteil des Mängelmelders", "Nicht lösbar", "Kein Handlungsbedarf"];
      let status = "Offen";
      for (const s of knownStatuses) {
        if (articleText.includes(s)) {
          status = s;
          break;
        }
      }

      const knownCategories = ["Poller defekt", "Ampel defekt (Taste/Licht)", "Illegale Plakatierung", "Wilde Müllkippe, Sperrmüllreste", "Straßenschild / Verkehrszeichen defekt", "Straßenkanaldeckel defekt", "Straßen-, Radweg- und Gehwegschäden", "Gully / Bachablauf verstopft", "Friedhofsunterhaltung", "abgemeldete Fahrzeuge", "Fahrradwracks", "Straßenbeleuchtung / Laterne defekt", "Spielplatzunterhaltung"];
      let category = "";
      for (const cat of knownCategories) {
        if (articleText.includes(cat)) {
          category = cat;
          break;
        }
      }

      let fullDescription = "";
      let current = article.nextElementSibling;
      while (current) {
        const heading = current.querySelector("h1");
        if (heading?.textContent?.includes("Bearbeitungshistorie")) {
          break;
        }

        const paragraphs = current.querySelectorAll("p");
        paragraphs.forEach((p) => {
          const text = p.textContent?.trim() || "";
          if (text && text.length > 5) {
            fullDescription += (fullDescription ? "\n\n" : "") + text;
          }
        });
        current = current.nextElementSibling;
        if (fullDescription.length > 50) break;
      }

      let statusHistory: Array<{ timestamp: string; status: string }> = [];
      const allH1 = document.querySelectorAll("h1");
      let historySection: Element | null = null;

      for (const h1 of allH1) {
        if (h1.textContent?.includes("Bearbeitungshistorie")) {
          historySection = h1.parentElement;
          break;
        }
      }

      if (historySection) {
        const historyList = historySection.querySelector("ul");
        if (historyList) {
          const listItems = historyList.querySelectorAll("li");
          listItems.forEach((item) => {
            const paragraphs = item.querySelectorAll("p");
            if (paragraphs.length >= 2) {
              const timestamp = paragraphs[0].textContent?.trim() || "";
              let statusText = "";
              const h2s = item.querySelectorAll("h2");
              for (let i = 0; i < h2s.length; i++) {
                if (h2s[i].textContent?.includes("Status")) {
                  const nextP = h2s[i].nextElementSibling;
                  if (nextP && nextP.tagName === "P") {
                    statusText = nextP.textContent?.trim() || "";
                  }
                }
              }

              if (timestamp && statusText) {
                statusHistory.push({ timestamp, status: statusText });
              }
            }
          });
        }
      }

      return {
        createdAt,
        author,
        location,
        status,
        category,
        description: fullDescription,
        statusHistory: statusHistory.length > 0 ? JSON.stringify(statusHistory) : undefined,
      };
    });

    await context.close();
    return detailData;
  } catch (error) {
    console.error(`Error scraping detail page for ID ${externalId}:`, error);
    if (context) await context.close();
    return null;
  }
}

async function testHistoryScraper() {
  console.log("=== Testing Status History Scraper ===\n");

  const browser = await chromium.launch({ headless: true });

  // Test with Mangel 32241 which has status history
  const externalId = "32241";
  console.log(`Scraping Mangel ${externalId}...\n`);

  const result = await scrapeMaengelDetailWithHistory(browser, externalId);

  if (result) {
    console.log("Scraped Data:");
    console.log("  Author:", result.author);
    console.log("  Status:", result.status);
    console.log("  Category:", result.category);
    console.log("  Location:", result.location);
    console.log("  Created At:", result.createdAt);
    console.log("\nStatus History:");
    if (result.statusHistory) {
      const history = JSON.parse(result.statusHistory);
      history.forEach((entry: any, i: number) => {
        console.log(`  ${i + 1}. ${entry.timestamp} - ${entry.status}`);
      });
    } else {
      console.log("  No status history found");
    }
  } else {
    console.log("Failed to scrape data");
  }

  await browser.close();
}

testHistoryScraper().catch(console.error);
