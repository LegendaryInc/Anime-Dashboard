/**
 * Image Download & Organization Tool
 * 
 * Downloads images, organizes them by anime/character, detects duplicates,
 * and gives them rarity-specific filenames.
 * 
 * Optional: Install 'sharp' for image optimization:
 *   npm install --save-dev sharp
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Try to load sharp for image optimization (optional)
let sharp = null;
try {
  sharp = require('sharp');
} catch (error) {
  // Sharp not installed - image optimization will be skipped
}

// Configuration
const IMAGE_DIR = path.join(__dirname, '..', 'images', 'gacha');
const DOWNLOADS_DIR = path.join(__dirname, '..', 'images', 'downloads');
const MANIFEST_FILE = path.join(__dirname, '..', 'gacha-manifest.json');
const HASH_CACHE_FILE = path.join(__dirname, '..', 'data', '.image-hashes.json');

// Image processing settings
const MAX_IMAGE_SIZE = 1024 * 1024 * 5; // 5MB max
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const TARGET_SIZE = { width: 400, height: 600 }; // Standard card size

// Load existing image hashes for duplicate detection
let imageHashes = {};
if (fs.existsSync(HASH_CACHE_FILE)) {
  try {
    imageHashes = JSON.parse(fs.readFileSync(HASH_CACHE_FILE, 'utf8'));
  } catch (error) {
    console.log('⚠️  Could not load hash cache, starting fresh');
  }
}

// Load existing manifest for duplicate detection
let existingPaths = new Set();
if (fs.existsSync(MANIFEST_FILE)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    for (const anime in manifest) {
      for (const character in manifest[anime]) {
        const variants = manifest[anime][character];
        variants.forEach(v => {
          if (v.path) {
            existingPaths.add(v.path);
          }
        });
      }
    }
  } catch (error) {
    console.log('⚠️  Could not load manifest for duplicate detection');
  }
}

/**
 * Calculate image hash for duplicate detection
 */
function calculateImageHash(imagePath) {
  const fileBuffer = fs.readFileSync(imagePath);
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

/**
 * Check if image is duplicate
 */
function isDuplicate(imagePath) {
  const hash = calculateImageHash(imagePath);
  
  // Check against existing hashes
  for (const existingPath in imageHashes) {
    if (imageHashes[existingPath] === hash) {
      return { isDuplicate: true, existingPath };
    }
  }
  
  // Check against existing manifest paths
  const relativePath = path.relative(path.join(__dirname, '..'), imagePath);
  if (existingPaths.has(relativePath)) {
    return { isDuplicate: true, existingPath: relativePath };
  }
  
  return { isDuplicate: false };
}

/**
 * Download image from URL
 */
function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      // Check if response is valid
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      // Check content type
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        reject(new Error(`Invalid content type: ${contentType}`));
        return;
      }
      
      // Check file size
      const contentLength = parseInt(response.headers['content-length'] || '0');
      if (contentLength > MAX_IMAGE_SIZE) {
        reject(new Error(`File too large: ${contentLength} bytes`));
        return;
      }
      
      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(outputPath);
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Get file extension from URL or content type
 */
function getFileExtension(url, contentType) {
  // Try to get from URL
  const urlPath = new URL(url).pathname;
  const urlExt = path.extname(urlPath).toLowerCase();
  if (SUPPORTED_FORMATS.includes(urlExt)) {
    return urlExt;
  }
  
  // Try to get from content type
  if (contentType) {
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
    if (contentType.includes('png')) return '.png';
    if (contentType.includes('gif')) return '.gif';
    if (contentType.includes('webp')) return '.webp';
  }
  
  // Default to jpg
  return '.jpg';
}

/**
 * Format anime/character names for folder structure
 */
function formatFolderName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Determine rarity from filename or user input
 */
function determineRarity(filename, userRarity) {
  if (userRarity) {
    if (userRarity === 'Prismatic' || userRarity === 'prismatic') return 'Prismatic';
    const num = parseInt(userRarity);
    if (num >= 1 && num <= 5) return num;
  }
  
  // Try to detect from filename
  const lower = filename.toLowerCase();
  if (lower.includes('prismatic') || lower.includes('prism')) return 'Prismatic';
  if (lower.includes('legendary') || lower.includes('5-star') || lower.includes('-5')) return 5;
  if (lower.includes('epic') || lower.includes('4-star') || lower.includes('-4')) return 4;
  if (lower.includes('rare') || lower.includes('3-star') || lower.includes('-3')) return 3;
  if (lower.includes('common') || lower.includes('2-star') || lower.includes('-2')) return 2;
  
  return 2; // Default
}

/**
 * Generate filename with rarity
 */
function generateFilename(character, rarity, index = 1) {
  const charName = formatFolderName(character);
  
  if (rarity === 'Prismatic') {
    return `${charName}-prismatic-${index}.jpg`;
  } else {
    return `${charName}-${rarity}-${index}.jpg`;
  }
}

/**
 * Validate image file
 */
function validateImageFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    
    // Check file size
    if (stats.size === 0) {
      return { valid: false, error: 'File is empty' };
    }
    
    if (stats.size > MAX_IMAGE_SIZE) {
      return { valid: false, error: `File too large: ${stats.size} bytes` };
    }
    
    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_FORMATS.includes(ext)) {
      return { valid: false, error: `Unsupported format: ${ext}` };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Process a single image download
 */
async function processImage(url, anime, character, rarity) {
  const animeFolder = formatFolderName(anime);
  const characterFolder = formatFolderName(character);
  const targetDir = path.join(IMAGE_DIR, animeFolder, characterFolder);
  
  // Create directory structure
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Download to temporary location first
  const tempDir = DOWNLOADS_DIR;
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempFile = path.join(tempDir, `temp-${Date.now()}.jpg`);
  
  try {
    // Download image
    console.log(`  📥 Downloading: ${url}`);
    await downloadImage(url, tempFile);
    
    // Validate downloaded image
    const validation = validateImageFile(tempFile);
    if (!validation.valid) {
      fs.unlinkSync(tempFile);
      console.log(`  ❌ Invalid image: ${validation.error}`);
      return { success: false, reason: 'invalid', error: validation.error };
    }
    
    // Check if duplicate
    const duplicateCheck = isDuplicate(tempFile);
    if (duplicateCheck.isDuplicate) {
      fs.unlinkSync(tempFile);
      console.log(`  ⚠️  Duplicate detected (matches: ${duplicateCheck.existingPath})`);
      return { success: false, reason: 'duplicate', existingPath: duplicateCheck.existingPath };
    }
    
    // Find available filename
    let finalFilename = generateFilename(character, rarity, 1);
    let finalPath = path.join(targetDir, finalFilename);
    let counter = 1;
    
    while (fs.existsSync(finalPath)) {
      counter++;
      finalFilename = generateFilename(character, rarity, counter);
      finalPath = path.join(targetDir, finalFilename);
    }
    
    // Optimize/fix image if sharp is available
    if (sharp) {
      try {
        console.log(`  🔧 Optimizing image...`);
        const image = sharp(tempFile);
        const metadata = await image.metadata();
        
        // Resize if too large
        if (metadata.width > TARGET_SIZE.width || metadata.height > TARGET_SIZE.height) {
          await image
            .resize(TARGET_SIZE.width, TARGET_SIZE.height, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .jpeg({ quality: 85, mozjpeg: true })
            .toFile(finalPath);
          
          // Remove temp file
          fs.unlinkSync(tempFile);
          console.log(`  ✅ Resized and optimized: ${metadata.width}x${metadata.height} → optimized`);
        } else {
          // Just optimize without resizing
          await image
            .jpeg({ quality: 85, mozjpeg: true })
            .toFile(finalPath);
          
          // Remove temp file
          fs.unlinkSync(tempFile);
          console.log(`  ✅ Optimized image`);
        }
      } catch (error) {
        console.log(`  ⚠️  Optimization failed, using original: ${error.message}`);
        // Move original file if optimization fails
        fs.renameSync(tempFile, finalPath);
      }
    } else {
      // Move to final location without optimization
      fs.renameSync(tempFile, finalPath);
    }
    
    // Calculate and store hash
    const hash = calculateImageHash(finalPath);
    const relativePath = path.relative(path.join(__dirname, '..'), finalPath);
    imageHashes[relativePath] = hash;
    
    console.log(`  ✅ Saved: ${animeFolder}/${characterFolder}/${finalFilename}`);
    
    return {
      success: true,
      path: relativePath,
      filename: finalFilename,
      anime: animeFolder,
      character: characterFolder,
      rarity: rarity
    };
    
  } catch (error) {
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Save hash cache
 */
function saveHashCache() {
  fs.writeFileSync(HASH_CACHE_FILE, JSON.stringify(imageHashes, null, 2));
  console.log(`\n💾 Hash cache saved to ${HASH_CACHE_FILE}`);
}

/**
 * Process batch of images from JSON file or command line
 */
async function processBatch(imageList) {
  console.log('🚀 Starting Image Download & Organization\n');
  console.log('=' .repeat(60));
  console.log('');
  
  const results = {
    success: [],
    failed: [],
    duplicates: []
  };
  
  for (let i = 0; i < imageList.length; i++) {
    const item = imageList[i];
    const { url, anime, character, rarity } = item;
    
    if (!url || !anime || !character) {
      console.log(`⚠️  Skipping item ${i + 1}: missing required fields`);
      results.failed.push({ item, reason: 'missing fields' });
      continue;
    }
    
    console.log(`[${i + 1}/${imageList.length}] Processing: ${anime} > ${character}`);
    
    const result = await processImage(url, anime, character, rarity);
    
    if (result.success) {
      results.success.push(result);
    } else if (result.reason === 'duplicate') {
      results.duplicates.push({ item, existingPath: result.existingPath });
    } else {
      results.failed.push({ item, reason: result.reason || result.error });
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Save hash cache
  saveHashCache();
  
  // Print summary
  console.log('');
  console.log('=' .repeat(60));
  console.log('📊 Summary:');
  console.log(`  ✅ Successfully downloaded: ${results.success.length}`);
  console.log(`  ⚠️  Duplicates skipped: ${results.duplicates.length}`);
  console.log(`  ❌ Failed: ${results.failed.length}`);
  console.log('');
  
  if (results.success.length > 0) {
    console.log('💡 Next steps:');
    console.log('  1. Review downloaded images');
    console.log('  2. Run: npm run generate:manifest');
    console.log('  3. Run: npm run validate:manifest');
    console.log('');
  }
  
  return results;
}

/**
 * Read image list from file
 */
function readImageList(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  
  if (!Array.isArray(data)) {
    console.error('❌ Image list must be an array');
    process.exit(1);
  }
  
  return data;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📥 Image Download & Organization Tool\n');
    console.log('Usage:');
    console.log('  node scripts/download-images.js <image-list.json>');
    console.log('');
    console.log('Image list JSON format:');
    console.log(JSON.stringify([
      {
        "url": "https://example.com/image.jpg",
        "anime": "Anime Name",
        "character": "Character Name",
        "rarity": 5  // Optional: 1-5 or "Prismatic"
      }
    ], null, 2));
    console.log('');
    console.log('Example:');
    console.log('  node scripts/download-images.js images-to-download.json');
    process.exit(0);
  }
  
  const imageListFile = args[0];
  const imageList = readImageList(imageListFile);
  
  await processBatch(imageList);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

