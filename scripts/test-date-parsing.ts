import { formatRelativeTime } from "../lib/utils";

// Test with real dates from database
const testDates = [
  "Mi., 23.07.2025 - 16:48",  // From screenshot - should be "Vor X Tagen"
  "Do., 24.07.2025 - 08:05",  // Should show relative
  "Fr., 10.10.2025 - 07:12",  // Should be "Vorgestern"
  "Sa., 11.10.2025 - 14:21",  // Should be "Gestern"
  "So., 12.10.2025 - 10:22",  // Should be "Heute"
];

console.log("Testing date parsing and relative time:");
console.log("Current date:", new Date().toISOString());
console.log("");

testDates.forEach(dateStr => {
  const result = formatRelativeTime(dateStr);
  console.log(`${dateStr}`);
  console.log(`  => ${result}`);
  console.log("");
});
