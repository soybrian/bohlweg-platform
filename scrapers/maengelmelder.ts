/**
 * Mängelmelder Scraper Module
 *
 * Scrapt Mängel von https://mitreden.braunschweig.de/maengelmelder
 * Verwendet Playwright und scrapt auch die Detailseiten für vollständige Informationen.
 */

import { chromium, Browser, Page } from "playwright";
import { upsertMaengel, startScraperRun, endScraperRun } from "../lib/db";
import { updateProgress } from "../lib/progress-tracker";

const BASE_URL = "https://mitreden.braunschweig.de/maengelmelder";

export interface ScrapedMaengel {
  externalId: string;
  title: string;
  description: string;
  author: string;
  category: string;
  status: string;
  location: string;
  photoUrl?: string;
  createdAt: string;
  url: string;
  statusHistory?: string; // JSON array of { timestamp, status }
}

/**
 * Scrape Detail-Seite eines Mangels in neuem Browser-Context
 * Verwendet die Node-URL /node/{id} für korrekte Datenextraktion
 */
async function scrapeMaengelDetail(browser: Browser, externalId: string): Promise<Partial<ScrapedMaengel>> {
  let context = null;
  try {
    context = await browser.newContext();
    const detailPage = await context.newPage();

    // Don't block images since we need to extract photoUrl
    await detailPage.route('**/*.{css,woff,woff2}', route => route.abort());

    // Navigate to node page
    const detailUrl = `https://mitreden.braunschweig.de/node/${externalId}`;
    await detailPage.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Wait for content to load
    await detailPage.waitForSelector("article", { timeout: 5000 });

    // Extract all data using evaluate() since Playwright doesn't work well with <generic> elements
    const detailData = await detailPage.evaluate(() => {
      const article = document.querySelector("article");
      if (!article) return null;

      // Extract date from <time> element
      const timeEl = article.querySelector("time");
      const createdAt = timeEl?.textContent?.trim() || "";

      // Extract author - look for text between "Gespeichert von" and "am"
      const articleText = article.textContent || "";
      const authorMatch = articleText.match(/Gespeichert von\s+(\S+)\s+am/);
      const author = authorMatch?.[1] || "Anonym";

      // Extract location from body text using regex
      const bodyText = document.body.textContent || "";
      const locationMatch = bodyText.match(/([A-Za-zäöüßÄÖÜ\s\-\.]+\s+\d+[a-z]?,?\s+\d{5}\s+Braunschweig)/);
      const location = locationMatch?.[1]?.trim() || "";

      // Extract status
      const knownStatuses = ["Unbearbeitet", "in Bearbeitung", "Erledigt / beauftragt", "In der Arbeitsplanung berücksichtigt", "Keine Zuständigkeit der Stadtverwaltung", "Das Anliegen ist derzeit nicht Bestandteil des Mängelmelders", "Nicht lösbar", "Kein Handlungsbedarf"];
      let status = "Offen";
      for (const s of knownStatuses) {
        if (articleText.includes(s)) {
          status = s;
          break;
        }
      }

      // Extract category
      const knownCategories = ["Poller defekt", "Ampel defekt (Taste/Licht)", "Illegale Plakatierung", "Wilde Müllkippe, Sperrmüllreste", "Straßenschild / Verkehrszeichen defekt", "Straßenkanaldeckel defekt", "Straßen-, Radweg- und Gehwegschäden", "Gully / Bachablauf verstopft", "Friedhofsunterhaltung", "abgemeldete Fahrzeuge", "Fahrradwracks", "Straßenbeleuchtung / Laterne defekt", "Spielplatzunterhaltung"];
      let category = "";
      for (const cat of knownCategories) {
        if (articleText.includes(cat)) {
          category = cat;
          break;
        }
      }

      // Extract description - look for paragraphs after the article
      let fullDescription = "";
      let current = article.nextElementSibling;
      while (current) {
        // Stop if we encounter Bearbeitungshistorie section
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
        // Stop after checking a few siblings
        if (fullDescription.length > 50) break;
      }

      // Extract status history by finding h1 with "Bearbeitungshistorie"
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
              // Find the paragraph after "Status" heading
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

      // Use the most recent status from history if available
      const finalStatus = statusHistory.length > 0 ? statusHistory[0].status : status;

      return {
        createdAt,
        author,
        location,
        status: finalStatus,
        category,
        description: fullDescription,
        statusHistory: statusHistory.length > 0 ? JSON.stringify(statusHistory) : undefined,
      };
    });

    // Extract photo URL from uploaded image section
    let photoUrl: string | undefined;
    const imageElement = await detailPage.$("div.field--field_upload img");
    if (imageElement) {
      const src = await imageElement.getAttribute("src");
      if (src && !src.includes("icon") && !src.includes("logo") && !src.includes("tile.geofabrik") && !src.includes("openstreetmap")) {
        // Convert relative URLs to absolute
        photoUrl = src.startsWith("http") ? src : `https://mitreden.braunschweig.de${src}`;
      }
    }

    await context.close();

    return {
      description: detailData?.description || "",
      author: detailData?.author || "Anonym",
      location: detailData?.location || "",
      category: detailData?.category || "",
      status: detailData?.status || "Offen",
      createdAt: detailData?.createdAt || "",
      photoUrl,
      statusHistory: detailData?.statusHistory,
    };
  } catch (error) {
    console.error(`[Mängelmelder] Fehler beim Scrapen der Detail-Seite für ID ${externalId}:`, error);
    if (context) await context.close();
    return {};
  }
}

/**
 * Extrahiere Mängel von einer Übersichtsseite
 */
async function extractMaengelFromPage(page: Page, browser: Browser, scrapeDetails: boolean = true): Promise<ScrapedMaengel[]> {
  let maengelList: ScrapedMaengel[] = [];

  await page.waitForSelector("article", { timeout: 10000 });

  // Extrahiere alle Daten als Plain Objects, nicht als Element Handles
  const maengelData = await page.$$eval("article", (articles) => {
    return articles.map((article) => {
      const titleElement = article.querySelector("h3 a");
      const title = titleElement?.textContent || "";
      const urlPath = titleElement?.getAttribute("href") || "";
      const url = urlPath ? `https://mitreden.braunschweig.de${urlPath}` : "";
      const externalId = urlPath?.match(/\/node\/(\d+)/)?.[1] || "";

      const descElement = article.querySelector("p");
      const description = descElement?.textContent?.trim() || "";

      const metaText = article.textContent || "";
      const authorMatch = metaText.match(/Gespeichert von\s+(\S+)\s+am/);
      const author = authorMatch?.[1] || "Anonym";

      const dateMatch = metaText.match(/am\s+([^|]+)/);
      const createdAt = dateMatch?.[1]?.trim() || "";

      let location = "";
      const genericElements = article.querySelectorAll("generic");
      for (const el of genericElements) {
        const text = el.textContent || "";
        if (text && text.match(/\d{5}\s+Braunschweig/)) {
          location = text.trim();
          break;
        }
      }

      const knownCategories = ["Poller defekt", "Ampel defekt (Taste/Licht)", "Illegale Plakatierung", "Wilde Müllkippe, Sperrmüllreste", "Straßenschild / Verkehrszeichen defekt", "Straßenkanaldeckel defekt", "Straßen-, Radweg- und Gehwegschäden", "Gully / Bachablauf verstopft", "Friedhofsunterhaltung", "abgemeldete Fahrzeuge", "Fahrradwracks", "Straßenbeleuchtung / Laterne defekt", "Spielplatzunterhaltung"];
      let category = "";
      for (const el of genericElements) {
        const text = el.textContent || "";
        if (text) {
          for (const cat of knownCategories) {
            if (text.includes(cat)) {
              category = cat;
              break;
            }
          }
          if (category) break;
        }
      }

      const knownStatuses = ["Unbearbeitet", "in Bearbeitung", "Erledigt / beauftragt", "In der Arbeitsplanung berücksichtigt", "Keine Zuständigkeit der Stadtverwaltung", "Das Anliegen ist derzeit nicht Bestandteil des Mängelmelders", "Nicht lösbar", "Kein Handlungsbedarf"];
      let status = "Offen";
      for (const el of genericElements) {
        const text = el.textContent || "";
        if (text) {
          for (const s of knownStatuses) {
            if (text.includes(s)) {
              status = s;
              break;
            }
          }
          if (status !== "Offen") break;
        }
      }

      return {
        externalId,
        title: title.trim(),
        description,
        author,
        category,
        status,
        location,
        createdAt,
        url,
      };
    });
  });

  // Scrape Detail-Seiten sequenziell um Konflikte zu vermeiden
  const filteredData = maengelData.filter((maengel) => maengel.externalId && maengel.title);

  for (const maengel of filteredData) {
    try {
      if (scrapeDetails && maengel.externalId) {
        const detailData = await scrapeMaengelDetail(browser, maengel.externalId);

        // Merge detail data with list data, preferring detail data when available
        maengelList.push({
          ...maengel,
          // Always use detail description if available (it's cleaner than list description)
          description: detailData.description || maengel.description,
          author: detailData.author || maengel.author,
          location: detailData.location || maengel.location,
          category: detailData.category || maengel.category,
          status: detailData.status || maengel.status,
          createdAt: detailData.createdAt || maengel.createdAt,
          photoUrl: detailData.photoUrl,
          statusHistory: detailData.statusHistory,
        });
      } else {
        maengelList.push(maengel);
      }
    } catch (error) {
      console.error("[Mängelmelder] Fehler beim Extrahieren eines Mangels:", error);
      maengelList.push(maengel);
    }
  }

  return maengelList;
}

/**
 * Prüfe ob es eine nächste Seite gibt
 */
async function hasNextPage(page: Page): Promise<boolean> {
  const nextButton = await page.$('a:has-text("Nächste")');
  return nextButton !== null;
}

/**
 * Gehe zur nächsten Seite
 */
async function goToNextPage(page: Page): Promise<boolean> {
  const nextButton = await page.$('a:has-text("Nächste")');
  if (nextButton) {
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }),
        nextButton.click()
      ]);
      return true;
    } catch (error) {
      // Wenn networkidle timeout, versuche mit domcontentloaded
      console.log("[Mängelmelder] Netzwerk-Timeout, verwende kürzere Wartezeit...");
      try {
        await page.waitForLoadState("domcontentloaded", { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  }
  return false;
}

/**
 * Haupt-Scraper-Funktion
 */
export async function scrapeMaengelmelder(scrapeDetails: boolean = true, maxPages?: number): Promise<{
  success: boolean;
  itemsScraped: number;
  itemsNew: number;
  itemsUpdated: number;
  error?: string;
}> {
  const runId = startScraperRun("maengelmelder");
  let browser: Browser | null = null;
  let itemsScraped = 0;
  let itemsNew = 0;
  let itemsUpdated = 0;

  try {
    console.log("[Mängelmelder] Starte Scraping...");

    // Initialer Progress
    updateProgress({
      moduleKey: "maengelmelder",
      status: "running",
      currentPage: 0,
      itemsScraped: 0,
      itemsNew: 0,
      itemsUpdated: 0,
      message: "Starte Browser...",
      timestamp: new Date().toISOString(),
    });

    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
      ]
    });
    const page = await browser.newPage();

    // Performance-Optimierungen
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'de-DE,de;q=0.9',
    });

    updateProgress({
      moduleKey: "maengelmelder",
      status: "running",
      currentPage: 0,
      itemsScraped: 0,
      itemsNew: 0,
      itemsUpdated: 0,
      message: "Lade Seite...",
      timestamp: new Date().toISOString(),
    });

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    console.log("[Mängelmelder] Seite geladen");

    let currentPage = 1;

    while (true) {
      console.log(`[Mängelmelder] Scrape Seite ${currentPage}...`);

      updateProgress({
        moduleKey: "maengelmelder",
        status: "running",
        currentPage,
        itemsScraped,
        itemsNew,
        itemsUpdated,
        message: `Scrape Seite ${currentPage}...`,
        timestamp: new Date().toISOString(),
      });

      const maengelList = await extractMaengelFromPage(page, browser, scrapeDetails);
      console.log(`[Mängelmelder] ${maengelList.length} Mängel auf Seite ${currentPage} gefunden`);

      const scraped_at = new Date().toISOString();

      for (const maengel of maengelList) {
        const result = upsertMaengel({ ...maengel, scraped_at });
        itemsScraped++;
        if (result.isNew) {
          itemsNew++;
        } else if (result.hasChanged) {
          itemsUpdated++;
        }
      }

      // Check if we reached max pages limit
      if (maxPages && currentPage >= maxPages) {
        console.log(`[Mängelmelder] Max pages (${maxPages}) reached, stopping.`);
        break;
      }

      if (await hasNextPage(page)) {
        const success = await goToNextPage(page);
        if (!success) break;
        currentPage++;
        await page.waitForTimeout(500); // Reduziert von 1000ms auf 500ms
      } else {
        break;
      }
    }

    await browser.close();

    console.log(`[Mängelmelder] Scraping abgeschlossen: ${itemsScraped} Items (${itemsNew} neu, ${itemsUpdated} aktualisiert)`);

    // Generiere Zusammenfassung wenn relevante Änderungen
    if (itemsNew > 5 || itemsUpdated > 10) {
      console.log("[Mängelmelder] Generiere AI-Zusammenfassung...");
      try {
        const { generateAndSaveSummary } = await import("../lib/ai-summary");
        await generateAndSaveSummary("maengelmelder");
        console.log("[Mängelmelder] ✓ Zusammenfassung erstellt");
      } catch (error) {
        console.error("[Mängelmelder] Fehler bei Zusammenfassung:", error);
        // Continue anyway
      }
    }

    updateProgress({
      moduleKey: "maengelmelder",
      status: "completed",
      itemsScraped,
      itemsNew,
      itemsUpdated,
      message: `Abgeschlossen: ${itemsScraped} Items (${itemsNew} neu, ${itemsUpdated} aktualisiert)`,
      timestamp: new Date().toISOString(),
    });

    endScraperRun(runId, {
      itemsScraped,
      itemsNew,
      itemsUpdated,
      success: true,
    });

    return {
      success: true,
      itemsScraped,
      itemsNew,
      itemsUpdated,
    };
  } catch (error) {
    console.error("[Mängelmelder] Fehler beim Scraping:", error);

    if (browser) {
      await browser.close();
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    updateProgress({
      moduleKey: "maengelmelder",
      status: "error",
      itemsScraped,
      itemsNew,
      itemsUpdated,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    endScraperRun(runId, {
      itemsScraped,
      itemsNew,
      itemsUpdated,
      success: false,
      error: errorMessage,
    });

    return {
      success: false,
      itemsScraped,
      itemsNew,
      itemsUpdated,
      error: errorMessage,
    };
  }
}

if (require.main === module) {
  scrapeMaengelmelder(true)
    .then((result) => {
      console.log("Scraping abgeschlossen:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Unerwarteter Fehler:", error);
      process.exit(1);
    });
}
