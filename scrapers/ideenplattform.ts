/**
 * Ideenplattform Scraper Module
 *
 * Scrapt Ideen von https://mitreden.braunschweig.de/ideenplattform
 * Verwendet Playwright und scrapt auch die Detailseiten für vollständige Informationen.
 */

import { chromium, Browser, Page } from "playwright";
import { upsertIdea, startScraperRun, endScraperRun, getDatabase } from "../lib/db";
import { updateProgress } from "../lib/progress-tracker";
import { enhanceIdea } from "../lib/ai/openai-service";

const BASE_URL = "https://mitreden.braunschweig.de/ideenplattform";

export interface ScrapedIdea {
  externalId: string;
  title: string;
  description: string;
  author: string;
  category: string;
  status: string;
  supporters: number;
  maxSupporters: number;
  comments: number;
  commentsData?: string;
  createdAt: string;
  url: string;
  // AI Enhancement Fields
  votingDeadline?: string;
  votingExpired?: boolean;
  supportersList?: string;
  aiSummary?: string;
  aiHashtags?: string;
  detailScraped?: boolean;
  detailScrapedAt?: string;
}

/**
 * Parse voting deadline from German text
 */
function parseVotingDeadline(text: string): { deadline: string | null; expired: boolean } {
  // Match patterns like "bis zum 31.12.2025" or "Zeitraum für Stimmabgabe überschritten"
  const deadlineMatch = text.match(/bis zum (\d{1,2}\.\d{1,2}\.\d{4})/);
  const isExpired = text.includes("Zeitraum für Stimmabgabe überschritten");

  if (deadlineMatch) {
    const [day, month, year] = deadlineMatch[1].split('.');
    const deadline = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    return { deadline, expired: deadlineDate < now };
  }

  return { deadline: null, expired: isExpired };
}

/**
 * Scrape Detail-Seite einer Idee in neuem Browser-Context
 * Extrahiert: Vollständige Beschreibung, Unterstützer-Liste, Abstimmungszeitraum, etc.
 */
async function scrapeIdeaDetail(browser: Browser, url: string, retries: number = 2): Promise<Partial<ScrapedIdea>> {
  let context = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Add small delay between attempts to prevent overwhelming the browser
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        console.log(`[Ideenplattform] Retry ${attempt}/${retries} for ${url}`);
      }

      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      });
      const detailPage = await context.newPage();

    // Blockiere unnötige Ressourcen für schnelleres Laden
    await detailPage.route('**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}', route => route.abort());

    await detailPage.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await detailPage.waitForSelector("h1", { timeout: 5000 });

    // Vollständiger Titel und Beschreibung von der Detailseite extrahieren
    const detailPageContent = await detailPage.evaluate(() => {
      // Extrahiere den vollständigen Titel von der Detailseite
      const h1Element = document.querySelector('h1');
      const fullTitle = h1Element?.textContent?.trim() || '';

      const descriptionParts: string[] = [];

      // Suche nach verschiedenen möglichen Container-Klassen
      const selectors = [
        '.field--name-body p',
        '.field--type-text-long p',
        '.field--name-field-body p',
        'article .field p'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 0 && !descriptionParts.includes(text)) {
              descriptionParts.push(text);
            }
          });
          break; // Wenn wir Beschreibungs-Elemente gefunden haben, breche ab
        }
      }

      return {
        fullTitle,
        fullDescription: descriptionParts.join('\n\n')
      };
    });

    // Extrahiere alle Daten von der Detailseite
    const detailData = await detailPage.evaluate(() => {
      const pageText = document.body.textContent || "";

      // Unterstützer-Liste extrahieren
      const supportersList: string[] = [];
      const supportersSection = Array.from(document.querySelectorAll('.field--name-field-supporters, .supporters-list'))
        .map(el => el.textContent || '');

      // Suche nach Namen in der Unterstützer-Sektion
      for (const section of supportersSection) {
        // Typische Muster: "Max Mustermann", separate Namen durch Komma oder Zeile
        const names = section
          .split(/[,\n]/)
          .map(name => name.trim())
          .filter(name => name.length > 2 && name.length < 50 && /^[A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ]/.test(name));
        supportersList.push(...names);
      }

      // Kommentare extrahieren
      const commentsList: Array<{author: string; text: string; date: string; isModerator: boolean}> = [];

      // Finde alle article.comment Elemente (skip das erste article, das ist der Haupt-Artikel)
      const allArticles = document.querySelectorAll('article');
      const commentArticles = Array.from(allArticles).slice(1); // Skip first article

      commentArticles.forEach(article => {
        try {
          // Suche nach dem div mit class="meta-information"
          const metaDiv = article.querySelector('div.meta-information');
          if (!metaDiv) return;

          const metaText = metaDiv.textContent || '';

          // Autor extrahieren - ist im <span> nach "Gespeichert von"
          const authorSpan = metaDiv.querySelector('span');
          const author = authorSpan?.textContent?.trim() || 'Anonym';

          // Prüfe ob es ein Moderator-Kommentar ist (Stadt Braunschweig)
          const isModerator = author === 'Moderator';

          // Datum extrahieren - kommt nach "am"
          const dateMatch = metaText.match(/am\s+((?:Mo\.|Di\.|Mi\.|Do\.|Fr\.|Sa\.|So\.),?\s+\d{2}\.\d{2}\.\d{4}\s+-\s+\d{2}:\d{2})/);
          const date = dateMatch ? dateMatch[1].trim() : '';

          // Kommentar-Text extrahieren - ist in den <p> Elementen
          const paragraphs = article.querySelectorAll('p');
          const textParts: string[] = [];

          paragraphs.forEach(p => {
            const pText = p.textContent?.trim();
            // Ignoriere leere Paragraphen und "Permalink"
            if (pText && pText.length > 0 && !pText.includes('Permalink')) {
              textParts.push(pText);
            }
          });

          const text = textParts.join('\n\n');

          if (text && text.length > 3 && author) {
            commentsList.push({ author, text, date, isModerator });
          }
        } catch (e) {
          // Skip invalid comments
        }
      });

      return {
        pageText,
        supportersList: supportersList.filter((name, index, self) => self.indexOf(name) === index), // Remove duplicates
        commentsList,
      };
    });

      // Parse Abstimmungszeitraum
      const votingInfo = parseVotingDeadline(detailData.pageText);

      await context.close();

      return {
        title: detailPageContent.fullTitle || undefined,
        description: detailPageContent.fullDescription,
        votingDeadline: votingInfo.deadline || undefined,
        votingExpired: votingInfo.expired,
        supportersList: detailData.supportersList.length > 0
          ? JSON.stringify(detailData.supportersList)
          : undefined,
        commentsData: detailData.commentsList.length > 0
          ? JSON.stringify(detailData.commentsList)
          : undefined,
        detailScraped: true,
        detailScrapedAt: new Date().toISOString(),
      };
    } catch (error) {
      // Close context if it was created
      if (context) {
        try {
          await context.close();
        } catch (closeError) {
          // Ignore close errors
        }
      }

      // If this was the last attempt, log error and return failure
      if (attempt === retries) {
        console.error(`[Ideenplattform] Fehler beim Scrapen der Detail-Seite ${url} nach ${retries + 1} Versuchen:`, error);
        return {
          detailScraped: false,
        };
      }
      // Otherwise, continue to next retry
    }
  }

  // Should never reach here, but return failure just in case
  return {
    detailScraped: false,
  };
}

/**
 * Extrahiere Ideen von einer Übersichtsseite
 */
async function extractIdeasFromPage(page: Page, browser: Browser, scrapeDetails: boolean = true): Promise<ScrapedIdea[]> {
  let ideas: ScrapedIdea[] = [];

  await page.waitForSelector("article", { timeout: 10000 });

  // Extrahiere alle Daten als Plain Objects, nicht als Element Handles
  const ideasData = await page.$$eval("article", (articles) => {
    return articles.map((article) => {
      const titleElement = article.querySelector("h3 a");
      const title = titleElement?.textContent || "";
      const urlPath = titleElement?.getAttribute("href") || "";
      const url = urlPath ? `https://mitreden.braunschweig.de${urlPath}` : "";
      const externalId = urlPath?.match(/\/node\/(\d+)/)?.[1] || "";

      // Alle <p> Tags innerhalb des Articles sammeln für vollständige Beschreibung
      const descElements = article.querySelectorAll("p");
      const descriptionParts: string[] = [];
      descElements.forEach(p => {
        const text = p.textContent?.trim();
        if (text && text.length > 0) {
          descriptionParts.push(text);
        }
      });
      const description = descriptionParts.join(" ");

      const metaText = article.textContent || "";
      const authorMatch = metaText.match(/Gespeichert von\s+(\S+)\s+am/);
      const author = authorMatch?.[1] || "Anonym";

      // Extract date more precisely - match German date format
      const dateMatch = metaText.match(/am\s+((?:Mo\.|Di\.|Mi\.|Do\.|Fr\.|Sa\.|So\.),\s+\d{2}\.\d{2}\.\d{4}\s+-\s+\d{2}:\d{2})/);
      const createdAt = dateMatch?.[1]?.trim() || "";

      const supportersMatch = metaText.match(/(\d+)\s+von\s+(\d+)\s+Unterstützern/);
      const supporters = supportersMatch ? parseInt(supportersMatch[1]) : 0;
      const maxSupporters = supportersMatch ? parseInt(supportersMatch[2]) : 50;

      const commentsMatch = metaText.match(/(\d+)\s+Kommentar/);
      const comments = commentsMatch ? parseInt(commentsMatch[1]) : 0;

      const knownCategories = ["Finanzen", "Verkehr", "Schule und Kultur", "Allgemeine Verwaltung", "Stadtgrün und Umwelt", "Wirtschaft", "Soziales, Jugend und Gesundheit", "Recht, Sicherheit und Ordnung", "Bauen und Planung"];
      let category = "";

      // Die Kategorie steht als direkter Text neben dem Kategorie-Icon
      // Suche nach dem gesamten Text und extrahiere bekannte Kategorien
      const fullText = article.textContent || "";
      for (const cat of knownCategories) {
        if (fullText.includes(cat)) {
          category = cat;
          break;
        }
      }

      // Extract status from the full text using known status values
      const knownStatuses = [
        "Die Idee wird den politischen Gremien zur Entscheidung vorgelegt",
        "Zeitraum für Stimmabgabe überschritten",
        "Keine Zuständigkeit der Stadtverwaltung",
        "Wird bei zukünftigen Planungen berücksichtigt",
        "Laufend",
        "Umgesetzt",
        "Abgelehnt",
        "Kein Handlungsbedarf",
        "Keine Idee",
        "Neu"
      ];

      let status = "In Prüfung";
      for (const s of knownStatuses) {
        if (metaText.includes(s)) {
          status = s;
          break;
        }
      }

      return {
        externalId,
        title: title.trim(),
        description,
        author,
        category,
        status,
        supporters,
        maxSupporters,
        comments,
        createdAt,
        url,
      };
    });
  });

  // Sequential scraping with controlled concurrency to prevent browser crashes
  // IMPORTANT: Parallel context creation causes browser crashes in Docker
  const filteredIdeas = ideasData.filter((ideaData) => ideaData.externalId && ideaData.title);

  // Process ideas with limited concurrency (max 2 at a time)
  const concurrencyLimit = 2;
  const processIdea = async (ideaData: typeof ideasData[0]) => {
      try {
        let title = ideaData.title;
        let description = ideaData.description;
        let detailData: Partial<ScrapedIdea> = {};

        // Scrape Detail-Seite für vollständige Informationen
        if (scrapeDetails && ideaData.url) {
          detailData = await scrapeIdeaDetail(browser, ideaData.url);

          // Verwende den vollständigen Titel von der Detailseite, falls vorhanden
          if (detailData.title && detailData.title.length > title.length) {
            title = detailData.title;
          }

          if (detailData.description && detailData.description.length > description.length) {
            description = detailData.description;
          }
        }

        // AI Enhancement: Generate title, summary and hashtags
        let aiSummary: string | undefined;
        let aiHashtags: string | undefined;
        let aiTitle: string | undefined;

        if (scrapeDetails && description && description.length > 50) {
          try {
            console.log(`[Ideenplattform] Generating AI enhancements for: ${title.substring(0, 70)}...`);
            const enhancement = await enhanceIdea(
              {
                title: title, // Verwende den vollständigen Titel
                category: ideaData.category,
                description: description,
              },
              true // include title generation
            );

            aiTitle = enhancement.aiTitle;
            aiSummary = enhancement.summary;
            aiHashtags = JSON.stringify(enhancement.hashtags);

            console.log(`[Ideenplattform] ✓ Original: ${title.substring(0, 70)}...`);
            console.log(`[Ideenplattform] ✓ AI Title: ${aiTitle}`);

            // Rate limiting: wait 350ms between AI requests
            await new Promise(resolve => setTimeout(resolve, 350));
          } catch (aiError) {
            console.error(`[Ideenplattform] AI enhancement failed for ${title}:`, aiError);
            // Continue without AI enhancement
          }
        }

        return {
          ...ideaData,
          title, // Verwende den vollständigen Titel
          description,
          ...detailData,
          aiTitle,
          aiSummary,
          aiHashtags,
          commentsData: detailData.commentsData,
        };
      } catch (error) {
        console.error("[Ideenplattform] Fehler beim Extrahieren einer Idee:", error);
        return {
          ...ideaData,
        };
      }
  };

  // Process ideas in batches with limited concurrency
  ideas = [];
  for (let i = 0; i < filteredIdeas.length; i += concurrencyLimit) {
    const batch = filteredIdeas.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(batch.map(processIdea));
    ideas.push(...batchResults);

    // Small delay between batches to prevent overwhelming the browser
    if (i + concurrencyLimit < filteredIdeas.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return ideas;
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
      console.log("[Ideenplattform] Netzwerk-Timeout, verwende kürzere Wartezeit...");
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
export async function scrapeIdeenplattform(scrapeDetails: boolean = true, maxPages?: number): Promise<{
  success: boolean;
  itemsScraped: number;
  itemsNew: number;
  itemsUpdated: number;
  error?: string;
}> {
  const runId = startScraperRun("ideenplattform");
  let browser: Browser | null = null;
  let itemsScraped = 0;
  let itemsNew = 0;
  let itemsUpdated = 0;

  try {
    console.log("[Ideenplattform] Starte Scraping...");

    updateProgress({
      moduleKey: "ideenplattform",
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
        '--disable-extensions',
        '--disable-features=VizDisplayCompositor',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu-compositing',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--force-color-profile=srgb',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-databases'
      ],
      timeout: 60000
    });
    const page = await browser.newPage();

    // Performance-Optimierungen
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'de-DE,de;q=0.9',
    });

    updateProgress({
      moduleKey: "ideenplattform",
      status: "running",
      currentPage: 0,
      itemsScraped: 0,
      itemsNew: 0,
      itemsUpdated: 0,
      message: "Lade Seite...",
      timestamp: new Date().toISOString(),
    });

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    console.log("[Ideenplattform] Seite geladen");

    let currentPage = 1;

    while (true) {
      console.log(`[Ideenplattform] Scrape Seite ${currentPage}...`);

      updateProgress({
        moduleKey: "ideenplattform",
        status: "running",
        currentPage,
        itemsScraped,
        itemsNew,
        itemsUpdated,
        message: `Scrape Seite ${currentPage}...`,
        timestamp: new Date().toISOString(),
      });

      const ideas = await extractIdeasFromPage(page, browser, scrapeDetails);
      console.log(`[Ideenplattform] ${ideas.length} Ideen auf Seite ${currentPage} gefunden`);

      const scraped_at = new Date().toISOString();

      for (const idea of ideas) {
        const result = upsertIdea({ ...idea, scraped_at });
        itemsScraped++;
        if (result.isNew) {
          itemsNew++;
        } else if (result.hasChanged) {
          itemsUpdated++;
        }
      }

      // Check if we reached max pages limit
      if (maxPages && currentPage >= maxPages) {
        console.log(`[Ideenplattform] Max pages (${maxPages}) reached, stopping.`);
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

    console.log(`[Ideenplattform] Scraping abgeschlossen: ${itemsScraped} Items (${itemsNew} neu, ${itemsUpdated} aktualisiert)`);

    // Generiere Zusammenfassung wenn relevante Änderungen
    if (itemsNew > 5 || itemsUpdated > 10) {
      console.log("[Ideenplattform] Generiere AI-Zusammenfassung...");
      try {
        const { generateAndSaveSummary } = await import("../lib/ai-summary");
        await generateAndSaveSummary("ideenplattform");
        console.log("[Ideenplattform] ✓ Zusammenfassung erstellt");
      } catch (error) {
        console.error("[Ideenplattform] Fehler bei Zusammenfassung:", error);
        // Continue anyway
      }
    }

    updateProgress({
      moduleKey: "ideenplattform",
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
    console.error("[Ideenplattform] Fehler beim Scraping:", error);

    if (browser) {
      await browser.close();
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    updateProgress({
      moduleKey: "ideenplattform",
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
  scrapeIdeenplattform(true)
    .then((result) => {
      console.log("Scraping abgeschlossen:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Unerwarteter Fehler:", error);
      process.exit(1);
    });
}
