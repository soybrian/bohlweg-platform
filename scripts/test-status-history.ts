/**
 * Test script to scrape a Mangel with status history
 */
import { chromium } from "playwright";

async function testStatusHistory() {
  console.log("Testing status history extraction...\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const externalId = "32241";
  const url = `https://mitreden.braunschweig.de/node/${externalId}`;

  console.log(`Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("article", { timeout: 5000 });

  const data = await page.evaluate(() => {
    // Find Bearbeitungshistorie section by searching for the h1
    const allH1 = document.querySelectorAll("h1");
    let historySection: Element | null = null;

    for (const h1 of allH1) {
      if (h1.textContent?.includes("Bearbeitungshistorie")) {
        historySection = h1.parentElement;
        break;
      }
    }

    let statusHistory: Array<{ timestamp: string; status: string }> = [];

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

    return {
      foundHistory: historySection !== null,
      statusHistory,
      h1Count: allH1.length,
    };
  });

  console.log("Results:");
  console.log("  H1 count:", data?.h1Count);
  console.log("  Found history section:", data?.foundHistory);
  console.log("  Status history entries:", data?.statusHistory.length);
  console.log("\nStatus History:");
  data?.statusHistory.forEach((entry, i) => {
    console.log(`  ${i + 1}. ${entry.timestamp} - ${entry.status}`);
  });

  await browser.close();
}

testStatusHistory().catch(console.error);
