/**
 * List All Images Tool
 * 
 * Lists all images used in the manifest and checks which ones exist
 * Useful for finding missing images or getting a complete list
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_FILE = path.join(__dirname, '..', 'gacha-manifest.json');
const IMAGE_DIR = path.join(__dirname, '..', 'images', 'gacha');

// Read manifest
const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));

const allImages = [];
const missingImages = [];
const existingImages = [];

console.log('📸 Listing all images from manifest...\n');

// Extract all image paths
for (const animeName in manifest) {
  const characters = manifest[animeName];
  for (const characterName in characters) {
    const variants = characters[characterName];
    for (const variant of variants) {
      if (variant.path) {
        allImages.push({
          path: variant.path,
          anime: animeName,
          character: characterName,
          rarity: variant.rarity
        });
        
        // Check if file exists
        const fullPath = path.join(__dirname, '..', variant.path);
        if (fs.existsSync(fullPath)) {
          existingImages.push(variant.path);
        } else {
          missingImages.push({
            path: variant.path,
            fullPath: fullPath,
            anime: animeName,
            character: characterName
          });
        }
      }
    }
  }
}

console.log(`Total images in manifest: ${allImages.length}`);
console.log(`✅ Existing: ${existingImages.length}`);
console.log(`❌ Missing: ${missingImages.length}`);
console.log('');

if (missingImages.length > 0) {
  console.log('❌ Missing Images:');
  missingImages.forEach((img, i) => {
    console.log(`  ${i + 1}. ${img.path}`);
    console.log(`     Location: ${img.anime} > ${img.character}`);
    console.log(`     Expected: ${img.fullPath}`);
    console.log('');
  });
}

// Export list to file
const outputFile = path.join(__dirname, '..', 'image-list.txt');
const output = allImages.map(img => img.path).join('\n');
fs.writeFileSync(outputFile, output);
console.log(`\n📄 Full image list saved to: ${outputFile}`);

// Generate report
const reportFile = path.join(__dirname, '..', 'image-report.json');
const report = {
  total: allImages.length,
  existing: existingImages.length,
  missing: missingImages.length,
  missingDetails: missingImages,
  allImages: allImages.map(img => img.path)
};
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(`📊 Detailed report saved to: ${reportFile}`);

