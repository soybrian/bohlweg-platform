/**
 * Test script to scrape a single Mangel with image and check if photo URL is extracted
 */
import { chromium } from "playwright";

async function testImageScraping() {
  console.log("=== Testing Image Scraping for Mangel 32241 ===\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const url = "https://mitreden.braunschweig.de/node/32241";
  console.log(`Navigating to: ${url}`);

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("article");

  // Check for uploaded image
  const imageElement = await page.$("div.field--field_upload img");
  console.log("\nImage element found:", !!imageElement);

  if (imageElement) {
    const src = await imageElement.getAttribute("src");
    console.log("Image src:", src);

    if (src && !src.includes("icon") && !src.includes("logo") && !src.includes("tile.geofabrik") && !src.includes("openstreetmap")) {
      const photoUrl = src.startsWith("http") ? src : `https://mitreden.braunschweig.de${src}`;
      console.log("\nFinal photo URL:", photoUrl);
    } else {
      console.log("\nFiltered out (map tile or icon)");
    }
  }

  await browser.close();
  console.log("\nTest completed!");
}

testImageScraping().catch(console.error);
