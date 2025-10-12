import { formatRelativeTime } from "../lib/utils";

// Test with various German date formats from the database
const testDates = [
  "So., 27.07.2025 - 12:53",
  "Fr., 10.10.2025 - 07:12",
  "Sa., 11.10.2025 - 18:42",
  "So., 12.10.2025 - 10:22",
];

console.log("Testing formatRelativeTime with German dates:\n");
console.log("Current date:", new Date().toLocaleString('de-DE'));
console.log("");

testDates.forEach((date) => {
  const formatted = formatRelativeTime(date);
  console.log(`${date} => ${formatted}`);
});
