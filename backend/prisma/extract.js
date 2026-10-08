const fs = require("fs");
const path = require("path");

const dataPath = path.resolve(__dirname, "../../js/data.js");
let code = fs.readFileSync(dataPath, "utf8");

// Convert top-level `const ` declarations to `var ` so they attach to global scope
code = code.replace(/\bconst (HERITAGE_SITES|CULTURE_SECTIONS|HERITAGE_WALKS|REVIEWS_SEED)\b/g, "var $1");

const fn = new Function(code + "\nreturn { HERITAGE_SITES, CULTURE_SECTIONS, HERITAGE_WALKS, REVIEWS_SEED };");
const result = fn();

console.log("Sites found:", result.HERITAGE_SITES.length);
console.log("Culture found:", result.CULTURE_SECTIONS.length);
console.log("Walks found:", result.HERITAGE_WALKS.length);
console.log("Reviews found for site IDs:", Object.keys(result.REVIEWS_SEED));

const outputPath = path.resolve(__dirname, "seedData.json");
fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      sites: result.HERITAGE_SITES,
      culture: result.CULTURE_SECTIONS,
      walks: result.HERITAGE_WALKS,
      reviews: result.REVIEWS_SEED,
    },
    null,
    2
  )
);

console.log("Saved accurately to:", outputPath);
