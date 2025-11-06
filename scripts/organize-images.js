/**
 * Organize Images Tool
 * 
 * Helps organize images into the proper folder structure
 * Creates directories and moves/copies images based on naming patterns
 */

const fs = require('fs');
const path = require('path');

const IMAGE_DIR = path.join(__dirname, '..', 'images', 'gacha');
const SOURCE_DIR = path.join(__dirname, '..', 'images', 'to-organize'); // Change this to your source folder

/**
 * Extract anime and character from filename
 * Supports patterns like:
 * - anime_character_variant.jpg
 * - anime-character-variant.jpg
 * - anime character variant.jpg
 */
function parseFilename(filename) {
  const nameWithoutExt = path.basename(filename, path.extname(filename));
  
  // Try different separators
  const separators = ['_', '-', ' '];
  
  for (const sep of separators) {
    const parts = nameWithoutExt.split(sep);
    if (parts.length >= 2) {
      return {
        anime: parts[0].toLowerCase().replace(/\s+/g, '-'),
        character: parts[1].toLowerCase().replace(/\s+/g, '-'),
        variant: parts.slice(2).join(sep) || '1'
      };
    }
  }
  
  return null;
}

/**
 * Create directory structure
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

/**
 * Organize images from source directory
 */
function organizeImages() {
  console.log('📁 Organizing Images\n');
  console.log('=' .repeat(60));
  console.log('');
  
  if (!fs.existsSync(SOURCE_DIR)) {
    console.log(`⚠️  Source directory not found: ${SOURCE_DIR}`);
    console.log(`💡 Create this directory and put images to organize there`);
    console.log(`💡 Or update SOURCE_DIR in the script to point to your images`);
    return;
  }
  
  const files = fs.readdirSync(SOURCE_DIR).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  });
  
  if (files.length === 0) {
    console.log('⚠️  No image files found in source directory');
    return;
  }
  
  console.log(`Found ${files.length} images to organize\n`);
  
  const stats = {
    organized: 0,
    skipped: 0,
    errors: 0
  };
  
  for (const file of files) {
    const parsed = parseFilename(file);
    
    if (!parsed) {
      console.log(`⚠️  Could not parse: ${file} (skipping)`);
      stats.skipped++;
      continue;
    }
    
    const { anime, character } = parsed;
    const targetDir = path.join(IMAGE_DIR, anime, character);
    const targetPath = path.join(targetDir, file);
    const sourcePath = path.join(SOURCE_DIR, file);
    
    try {
      // Create directory structure
      ensureDirectory(targetDir);
      
      // Check if file already exists
      if (fs.existsSync(targetPath)) {
        console.log(`⚠️  Already exists: ${anime}/${character}/${file} (skipping)`);
        stats.skipped++;
        continue;
      }
      
      // Copy file (or use fs.renameSync for move)
      fs.copyFileSync(sourcePath, targetPath);
      
      console.log(`✅ ${anime}/${character}/${file}`);
      stats.organized++;
    } catch (error) {
      console.log(`❌ Error organizing ${file}: ${error.message}`);
      stats.errors++;
    }
  }
  
  console.log('');
  console.log('=' .repeat(60));
  console.log('📊 Statistics:');
  console.log(`  Organized: ${stats.organized}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log('');
  
  if (stats.organized > 0) {
    console.log('💡 Next steps:');
    console.log('  1. Review organized images');
    console.log('  2. Run: node scripts/generate-manifest-from-images.js');
    console.log('  3. Run: npm run validate:manifest');
    console.log('');
  }
}

// Run
organizeImages();

