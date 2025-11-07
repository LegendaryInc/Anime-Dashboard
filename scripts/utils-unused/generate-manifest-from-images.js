/**
 * Generate Manifest from Images Tool
 * 
 * Scans your images/gacha/ directory and auto-generates manifest entries
 * This makes it easy to add new content - just drop images in folders and run this!
 */

const fs = require('fs');
const path = require('path');

const IMAGE_DIR = path.join(__dirname, '..', 'images', 'gacha');
const MANIFEST_FILE = path.join(__dirname, '..', 'gacha-manifest.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'gacha-manifest-new.json');

// Default rarity (can be overridden)
const DEFAULT_RARITY = 2;

/**
 * Convert folder name to formatted name
 * e.g., "5-toubun-no-hanayome" -> "5 Toubun no Hanayome"
 */
function formatName(folderName) {
  return folderName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get image files from directory
 */
function getImageFiles(dir) {
  const files = fs.readdirSync(dir);
  return files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  });
}

/**
 * Determine rarity from filename or folder structure
 * Looks for patterns like: character-1.jpg (rarity 1), character-5.jpg (rarity 5)
 * Or special names: character-prismatic.jpg
 */
function determineRarity(imagePath, characterName) {
  const filename = path.basename(imagePath, path.extname(imagePath));
  const lowerFilename = filename.toLowerCase();
  
  // Check for prismatic
  if (lowerFilename.includes('prismatic') || lowerFilename.includes('prism')) {
    return 'Prismatic';
  }
  
  // Check for rarity in filename (e.g., character-5.jpg)
  const rarityMatch = filename.match(/-(\d+)$/);
  if (rarityMatch) {
    const rarity = parseInt(rarityMatch[1]);
    if (rarity >= 1 && rarity <= 5) {
      return rarity;
    }
  }
  
  // Check for rarity in filename (e.g., character_5.jpg)
  const rarityMatch2 = filename.match(/_(\d+)$/);
  if (rarityMatch2) {
    const rarity = parseInt(rarityMatch2[1]);
    if (rarity >= 1 && rarity <= 5) {
      return rarity;
    }
  }
  
  // Check for special names (legendary, epic, etc.)
  if (lowerFilename.includes('legendary') || lowerFilename.includes('5-star')) {
    return 5;
  }
  if (lowerFilename.includes('epic') || lowerFilename.includes('4-star')) {
    return 4;
  }
  if (lowerFilename.includes('rare') || lowerFilename.includes('3-star')) {
    return 3;
  }
  if (lowerFilename.includes('common') || lowerFilename.includes('2-star')) {
    return 2;
  }
  
  // Default rarity
  return DEFAULT_RARITY;
}

/**
 * Scan directory and generate manifest structure
 */
function scanDirectory() {
  console.log('🔍 Scanning images directory...\n');
  
  if (!fs.existsSync(IMAGE_DIR)) {
    console.error(`❌ Images directory not found: ${IMAGE_DIR}`);
    console.log('💡 Create the directory structure: images/gacha/[anime]/[character]/');
    process.exit(1);
  }
  
  const manifest = {};
  const stats = {
    anime: 0,
    characters: 0,
    images: 0
  };
  
  // Read anime folders
  const animeFolders = fs.readdirSync(IMAGE_DIR).filter(item => {
    const itemPath = path.join(IMAGE_DIR, item);
    return fs.statSync(itemPath).isDirectory();
  });
  
  stats.anime = animeFolders.length;
  console.log(`Found ${stats.anime} anime folders\n`);
  
  for (const animeFolder of animeFolders) {
    const animePath = path.join(IMAGE_DIR, animeFolder);
    manifest[animeFolder] = {};
    
    // Read character folders
    const characterFolders = fs.readdirSync(animePath).filter(item => {
      const itemPath = path.join(animePath, item);
      return fs.statSync(itemPath).isDirectory();
    });
    
    if (characterFolders.length === 0) {
      console.log(`⚠️  No character folders found in: ${animeFolder}`);
      continue;
    }
    
    for (const characterFolder of characterFolders) {
      const characterPath = path.join(animePath, characterFolder);
      const imageFiles = getImageFiles(characterPath);
      
      if (imageFiles.length === 0) {
        console.log(`⚠️  No images found in: ${animeFolder}/${characterFolder}`);
        continue;
      }
      
      stats.characters++;
      
      // Create variants array
      const variants = imageFiles.map(imageFile => {
        const imagePath = path.join(characterFolder, imageFile);
        const fullImagePath = path.join('images', 'gacha', animeFolder, imagePath);
        const rarity = determineRarity(imageFile, characterFolder);
        
        stats.images++;
        
        return {
          path: fullImagePath,
          rarity: rarity
        };
      });
      
      // Sort variants by filename
      variants.sort((a, b) => {
        const nameA = path.basename(a.path).toLowerCase();
        const nameB = path.basename(b.path).toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      manifest[animeFolder][characterFolder] = variants;
      
      console.log(`  ✅ ${animeFolder}/${characterFolder}: ${variants.length} images`);
    }
  }
  
  console.log('\n📊 Statistics:');
  console.log(`  Anime: ${stats.anime}`);
  console.log(`  Characters: ${stats.characters}`);
  console.log(`  Total Images: ${stats.images}`);
  console.log('');
  
  return manifest;
}

/**
 * Load existing manifest and merge with new entries
 */
function mergeManifests(existingManifest, newManifest) {
  console.log('🔄 Merging with existing manifest...\n');
  
  const merged = { ...existingManifest };
  let added = 0;
  let updated = 0;
  
  for (const animeName in newManifest) {
    if (!merged[animeName]) {
      merged[animeName] = {};
      console.log(`  ➕ New anime: ${animeName}`);
    }
    
    for (const characterName in newManifest[animeName]) {
      const newVariants = newManifest[animeName][characterName];
      
      if (!merged[animeName][characterName]) {
        merged[animeName][characterName] = newVariants;
        added++;
        console.log(`  ➕ New character: ${animeName}/${characterName} (${newVariants.length} variants)`);
      } else {
        // Merge variants, avoiding duplicates
        const existingVariants = merged[animeName][characterName];
        const existingPaths = new Set(existingVariants.map(v => v.path));
        
        const newUniqueVariants = newVariants.filter(v => !existingPaths.has(v.path));
        if (newUniqueVariants.length > 0) {
          merged[animeName][characterName] = [...existingVariants, ...newUniqueVariants];
          updated++;
          console.log(`  ✏️  Updated: ${animeName}/${characterName} (+${newUniqueVariants.length} variants)`);
        }
      }
    }
  }
  
  console.log(`\n  Added: ${added} characters`);
  console.log(`  Updated: ${updated} characters`);
  console.log('');
  
  return merged;
}

/**
 * Main function
 */
function main() {
  console.log('📦 Generate Manifest from Images\n');
  console.log('=' .repeat(60));
  console.log('');
  
  // Scan directory
  const newManifest = scanDirectory();
  
  // Load existing manifest if it exists
  let existingManifest = {};
  if (fs.existsSync(MANIFEST_FILE)) {
    try {
      existingManifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
      console.log('📖 Loaded existing manifest\n');
    } catch (error) {
      console.log('⚠️  Could not load existing manifest, creating new one\n');
    }
  }
  
  // Merge manifests
  const finalManifest = mergeManifests(existingManifest, newManifest);
  
  // Write output
  const output = JSON.stringify(finalManifest, null, 2);
  fs.writeFileSync(OUTPUT_FILE, output);
  
  console.log('=' .repeat(60));
  console.log('✅ Manifest generated successfully!\n');
  console.log(`📄 Output file: ${OUTPUT_FILE}`);
  console.log(`📄 Original file: ${MANIFEST_FILE}`);
  console.log('');
  console.log('💡 Next steps:');
  console.log('  1. Review the generated manifest');
  console.log('  2. Update rarity values if needed');
  console.log('  3. Run: npm run validate:manifest');
  console.log('  4. If everything looks good, replace gacha-manifest.json with data/gacha-manifest-new.json');
  console.log('');
}

// Run
main();

