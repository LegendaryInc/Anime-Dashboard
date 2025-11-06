/**
 * Manifest Validation Tool
 * 
 * Validates gacha-manifest.json and cosmetics-manifest.json
 * Checks for:
 * - Broken image links
 * - Missing required fields
 * - Invalid rarity values
 * - Duplicate entries
 * - Structure errors
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

// Configuration
const MANIFEST_FILE = path.join(projectRoot, 'gacha-manifest.json');
const COSMETICS_FILE = path.join(projectRoot, 'cosmetics-manifest.json');
const IMAGE_BASE_PATH = path.join(projectRoot, 'public'); // Adjust if images are elsewhere

// Validation results
const errors = [];
const warnings = [];
const stats = {
  totalAnime: 0,
  totalCharacters: 0,
  totalCards: 0,
  brokenImages: 0,
  missingFields: 0,
  invalidRarity: 0,
  duplicates: 0
};

/**
 * Check if image file exists
 */
function checkImageExists(imagePath) {
  // Handle both relative and absolute paths
  let fullPath;
  
  if (path.isAbsolute(imagePath)) {
    fullPath = imagePath;
  } else if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    // External URL - skip file check
    return { exists: true, isExternal: true };
  } else {
    // Relative path - try multiple locations
    const possiblePaths = [
      path.join(projectRoot, imagePath),
      path.join(IMAGE_BASE_PATH, imagePath),
      path.join(projectRoot, 'images', imagePath),
      path.join(projectRoot, 'public', 'images', imagePath)
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return { exists: true, path: possiblePath };
      }
    }
    
    return { exists: false, triedPaths: possiblePaths };
  }
  
  return { exists: fs.existsSync(fullPath), path: fullPath };
}

/**
 * Validate rarity value
 */
function isValidRarity(rarity) {
  return (
    rarity === 'Prismatic' ||
    rarity === 'Legendary' ||
    rarity === 'Epic' ||
    rarity === 'Rare' ||
    rarity === 'Common' ||
    (typeof rarity === 'number' && rarity >= 1 && rarity <= 5)
  );
}

/**
 * Validate gacha manifest
 */
function validateGachaManifest(manifest) {
  console.log('📋 Validating Gacha Manifest...\n');
  
  if (!manifest || typeof manifest !== 'object') {
    errors.push('Manifest is not a valid object');
    return;
  }
  
  const cardIds = new Set();
  const animeNames = Object.keys(manifest);
  stats.totalAnime = animeNames.length;
  
  for (const animeName of animeNames) {
    const characters = manifest[animeName];
    
    if (!characters || typeof characters !== 'object') {
      errors.push(`Invalid anime entry: "${animeName}" - not an object`);
      continue;
    }
    
    const characterNames = Object.keys(characters);
    stats.totalCharacters += characterNames.length;
    
    for (const characterName of characterNames) {
      const variants = characters[characterName];
      
      if (!Array.isArray(variants)) {
        errors.push(`Invalid character entry: "${animeName}" > "${characterName}" - variants must be an array`);
        continue;
      }
      
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        stats.totalCards++;
        
        // Check required fields
        if (!variant.path) {
          errors.push(`Missing "path" in ${animeName} > ${characterName} > variant ${i}`);
          stats.missingFields++;
        }
        
        if (!variant.rarity) {
          errors.push(`Missing "rarity" in ${animeName} > ${characterName} > variant ${i}`);
          stats.missingFields++;
        }
        
        // Validate rarity
        if (variant.rarity && !isValidRarity(variant.rarity)) {
          errors.push(`Invalid rarity "${variant.rarity}" in ${animeName} > ${characterName} > variant ${i}`);
          stats.invalidRarity++;
        }
        
        // Check image
        if (variant.path) {
          const imageCheck = checkImageExists(variant.path);
          if (!imageCheck.exists) {
            errors.push(`Broken image: ${animeName} > ${characterName} > variant ${i} - "${variant.path}"`);
            stats.brokenImages++;
            
            // Show tried paths
            if (imageCheck.triedPaths) {
              warnings.push(`  Tried paths: ${imageCheck.triedPaths.slice(0, 2).join(', ')}`);
            }
          }
        }
        
        // Check for duplicates (same image path)
        const cardId = `${animeName}_${characterName}_${variant.path}`;
        if (cardIds.has(cardId)) {
          warnings.push(`Duplicate card: ${animeName} > ${characterName} > variant ${i} (same path)`);
          stats.duplicates++;
        }
        cardIds.add(cardId);
      }
    }
  }
}

/**
 * Validate cosmetics manifest
 */
function validateCosmeticsManifest(manifest) {
  console.log('✨ Validating Cosmetics Manifest...\n');
  
  if (!manifest || typeof manifest !== 'object') {
    errors.push('Cosmetics manifest is not a valid object');
    return;
  }
  
  if (!manifest.packs || typeof manifest.packs !== 'object') {
    warnings.push('No "packs" object found in cosmetics manifest');
    return;
  }
  
  const packIds = Object.keys(manifest.packs);
  
  for (const packId of packIds) {
    const pack = manifest.packs[packId];
    
    // Check required fields
    if (!pack.name) {
      errors.push(`Missing "name" in pack: ${packId}`);
      stats.missingFields++;
    }
    
    if (typeof pack.cost !== 'number' || pack.cost < 0) {
      errors.push(`Invalid or missing "cost" in pack: ${packId}`);
      stats.missingFields++;
    }
    
    if (!Array.isArray(pack.items) || pack.items.length === 0) {
      errors.push(`Missing or empty "items" array in pack: ${packId}`);
      stats.missingFields++;
    } else {
      // Validate items
      for (let i = 0; i < pack.items.length; i++) {
        const item = pack.items[i];
        
        if (!item.id) {
          errors.push(`Missing "id" in pack ${packId} > item ${i}`);
          stats.missingFields++;
        }
        
        if (!item.name) {
          warnings.push(`Missing "name" in pack ${packId} > item ${i}`);
        }
        
        if (!item.type) {
          warnings.push(`Missing "type" in pack ${packId} > item ${i}`);
        }
        
        if (!item.rarity) {
          warnings.push(`Missing "rarity" in pack ${packId} > item ${i}`);
        }
      }
    }
  }
}

/**
 * Main validation function
 */
async function validateAll() {
  console.log('🔍 Starting Manifest Validation...\n');
  console.log('=' .repeat(60));
  console.log('');
  
  // Read and validate gacha manifest
  try {
    const gachaManifestContent = fs.readFileSync(MANIFEST_FILE, 'utf8');
    const gachaManifest = JSON.parse(gachaManifestContent);
    validateGachaManifest(gachaManifest);
  } catch (error) {
    if (error.code === 'ENOENT') {
      errors.push(`Gacha manifest file not found: ${MANIFEST_FILE}`);
    } else if (error instanceof SyntaxError) {
      errors.push(`Gacha manifest JSON parse error: ${error.message}`);
    } else {
      errors.push(`Error reading gacha manifest: ${error.message}`);
    }
  }
  
  console.log('');
  
  // Read and validate cosmetics manifest
  try {
    const cosmeticsManifestContent = fs.readFileSync(COSMETICS_FILE, 'utf8');
    const cosmeticsManifest = JSON.parse(cosmeticsManifestContent);
    validateCosmeticsManifest(cosmeticsManifest);
  } catch (error) {
    if (error.code === 'ENOENT') {
      warnings.push(`Cosmetics manifest file not found: ${COSMETICS_FILE}`);
    } else if (error instanceof SyntaxError) {
      errors.push(`Cosmetics manifest JSON parse error: ${error.message}`);
    } else {
      warnings.push(`Error reading cosmetics manifest: ${error.message}`);
    }
  }
  
  // Print results
  console.log('');
  console.log('=' .repeat(60));
  console.log('📊 VALIDATION RESULTS');
  console.log('=' .repeat(60));
  console.log('');
  
  // Stats
  console.log('Statistics:');
  console.log(`  Total Anime: ${stats.totalAnime}`);
  console.log(`  Total Characters: ${stats.totalCharacters}`);
  console.log(`  Total Cards: ${stats.totalCards}`);
  console.log(`  Broken Images: ${stats.brokenImages}`);
  console.log(`  Missing Fields: ${stats.missingFields}`);
  console.log(`  Invalid Rarity: ${stats.invalidRarity}`);
  console.log(`  Duplicates: ${stats.duplicates}`);
  console.log('');
  
  // Errors
  if (errors.length > 0) {
    console.log(`❌ ERRORS (${errors.length}):`);
    errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
    console.log('');
  }
  
  // Warnings
  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length}):`);
    warnings.forEach((warning, i) => {
      console.log(`  ${i + 1}. ${warning}`);
    });
    console.log('');
  }
  
  // Summary
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All validations passed! No issues found.');
    process.exit(0);
  } else if (errors.length === 0) {
    console.log('✅ No critical errors, but some warnings found.');
    process.exit(0);
  } else {
    console.log(`❌ Validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }
}

// Run validation
validateAll().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

