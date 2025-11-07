/**
 * Fetch Multiple Images Per Character Tool
 * 
 * Fetches multiple images per character from random APIs (Waifu.im, Waifu.pics, Nekos)
 * to get variety in your gacha system!
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const WAIFU_IM_API = 'https://api.waifu.im';
const WAIFU_PICS_API = 'https://api.waifu.pics';
const NEKOS_API = 'https://nekos.best/api/v2';

const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'character-images.json');

let lastWaifuImRequest = 0;
let lastWaifuPicsRequest = 0;
let lastNekosRequest = 0;

const WAIFU_IM_DELAY = 300;
const WAIFU_PICS_DELAY = 500;
const NEKOS_DELAY = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch images from Waifu.im
 */
async function fetchWaifuImImages(tags = [], count = 10) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastWaifuImRequest;
  if (timeSinceLastRequest < WAIFU_IM_DELAY) {
    await sleep(WAIFU_IM_DELAY - timeSinceLastRequest);
  }

  try {
    lastWaifuImRequest = Date.now();
    const params = new URLSearchParams({
      included_tags: tags.join(','),
      limit: count.toString(),
      is_nsfw: 'false'
    });

    const response = await axios.get(`${WAIFU_IM_API}/search?${params}`, {
      timeout: 10000
    });

    const images = response.data?.images || [];
    return images.map(img => ({
      url: img.url,
      tags: img.tags || [],
      source: 'waifu.im'
    }));
  } catch (error) {
    console.error(`❌ Waifu.im error:`, error.message);
    return [];
  }
}

/**
 * Fetch images from Waifu.pics
 */
async function fetchWaifuPicsImages(category = 'waifu', count = 10) {
  const results = [];
  
  try {
    for (let i = 0; i < count; i++) {
      const now = Date.now();
      const timeSinceLastRequest = now - lastWaifuPicsRequest;
      if (timeSinceLastRequest < WAIFU_PICS_DELAY) {
        await sleep(WAIFU_PICS_DELAY - timeSinceLastRequest);
      }

      lastWaifuPicsRequest = Date.now();
      const response = await axios.get(`${WAIFU_PICS_API}/sfw/${category}`, {
        timeout: 5000
      });

      if (response.data?.url) {
        results.push({
          url: response.data.url,
          category: category,
          source: 'waifu.pics'
        });
      }
    }

    return results;
  } catch (error) {
    console.error(`❌ Waifu.pics error:`, error.message);
    return results;
  }
}

/**
 * Fetch images from Nekos API
 */
async function fetchNekosImages(category = 'waifu', count = 10) {
  const results = [];
  
  try {
    const validCategories = ['neko', 'kitsune', 'waifu', 'hug', 'kiss', 'pat', 'smug', 'baka', 'cry', 'dance', 'happy', 'highfive', 'shinobu', 'megumin', 'bully', 'yeet', 'awoo', 'lurk', 'peck', 'nom', 'stare', 'lick', 'bite', 'slap', 'kick', 'poke', 'wave', 'handhold', 'handshake', 'cuddle', 'bonk', 'wink', 'pat', 'kiss', 'hug'];
    
    if (!validCategories.includes(category)) {
      category = 'waifu';
    }

    for (let i = 0; i < count; i++) {
      const now = Date.now();
      const timeSinceLastRequest = now - lastNekosRequest;
      if (timeSinceLastRequest < NEKOS_DELAY) {
        await sleep(NEKOS_DELAY - timeSinceLastRequest);
      }

      lastNekosRequest = Date.now();
      const response = await axios.get(`${NEKOS_API}/${category}`, {
        timeout: 5000
      });

      if (response.data?.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        results.push({
          url: result.url,
          category: category,
          source: 'nekos'
        });
      }
    }

    return results;
  } catch (error) {
    console.error(`❌ Nekos API error:`, error.message);
    return results;
  }
}

/**
 * Randomize rarity with weighted distribution
 */
function randomizeRarity() {
  const rand = Math.random();
  if (rand < 0.6) return 2;      // 60% - Common
  if (rand < 0.9) return 3;      // 30% - Rare
  if (rand < 0.98) return 4;     // 8% - Epic
  if (rand < 0.999) return 5;   // 1.9% - Legendary
  return 'Prismatic';            // 0.1% - Prismatic
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('🎴 Fetch Multiple Images Per Character Tool\n');
    console.log('Fetches multiple random images per character from various APIs');
    console.log('Perfect for getting variety in your gacha system!\n');
    console.log('Usage:');
    console.log('  node scripts/fetch-multiple-images.js <character-list.json> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --images-per-character NUM  How many images per character (default: 3)');
    console.log('  --randomize-rarity          Randomize rarity (default: false)');
    console.log('  --source SOURCE            API source: waifu-im, waifu-pics, nekos, mixed (default: mixed)');
    console.log('');
    console.log('Character list JSON format:');
    console.log(JSON.stringify([
      {
        "anime": "Spy x Family",
        "character": "Yor Forger",
        "rarity": 5
      }
    ], null, 2));
    console.log('');
    console.log('Examples:');
    console.log('  # Get 5 images per character with randomized rarity');
    console.log('  node scripts/fetch-multiple-images.js my-characters.json --images-per-character 5 --randomize-rarity');
    console.log('');
    console.log('  # Get 3 images per character from Waifu.im only');
    console.log('  node scripts/fetch-multiple-images.js my-characters.json --source waifu-im');
    console.log('');
    process.exit(0);
  }

  const inputFile = args[0];
  const imagesPerCharArg = args.indexOf('--images-per-character');
  const imagesPerCharacter = imagesPerCharArg !== -1 && args[imagesPerCharArg + 1] ? 
    parseInt(args[imagesPerCharArg + 1]) : 3;
  
  const randomizeRarity = args.includes('--randomize-rarity');
  
  const sourceArg = args.indexOf('--source');
  const source = sourceArg !== -1 && args[sourceArg + 1] ? args[sourceArg + 1] : 'mixed';

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ File not found: ${inputFile}`);
    process.exit(1);
  }

  const characterList = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  
  if (!Array.isArray(characterList)) {
    console.error('❌ Character list must be an array');
    process.exit(1);
  }

  console.log('🎴 Fetch Multiple Images Per Character');
  console.log('=' .repeat(60));
  console.log(`\n📋 Characters: ${characterList.length}`);
  console.log(`🖼️  Images per character: ${imagesPerCharacter}`);
  console.log(`📡 Source: ${source}`);
  console.log(`🎲 Rarity: ${randomizeRarity ? 'Randomized (weighted)' : 'From JSON'}`);
  console.log('');

  const results = [];

  for (let i = 0; i < characterList.length; i++) {
    const item = characterList[i];
    const { anime, character, rarity } = item;

    console.log(`[${i + 1}/${characterList.length}] Processing: ${anime} > ${character}`);

    // Fetch images from different sources
    let images = [];
    
    if (source === 'mixed') {
      // Mix of all sources
      const perSource = Math.ceil(imagesPerCharacter / 3);
      const waifuIm = await fetchWaifuImImages(['waifu', 'anime'], perSource);
      const waifuPics = await fetchWaifuPicsImages('waifu', perSource);
      const nekos = await fetchNekosImages('waifu', perSource);
      images = [...waifuIm, ...waifuPics, ...nekos].slice(0, imagesPerCharacter);
    } else if (source === 'waifu-im') {
      images = await fetchWaifuImImages(['waifu', 'anime'], imagesPerCharacter);
    } else if (source === 'waifu-pics') {
      images = await fetchWaifuPicsImages('waifu', imagesPerCharacter);
    } else if (source === 'nekos') {
      images = await fetchNekosImages('waifu', imagesPerCharacter);
    }

    // Add each image with rarity
    images.forEach((img, idx) => {
      const finalRarity = randomizeRarity ? randomizeRarity() : (rarity || 2);
      
      results.push({
        url: img.url,
        anime: anime,
        character: character,
        rarity: finalRarity,
        source: img.source || source,
        variant: idx + 1
      });
    });

    console.log(`  ✅ Got ${images.length} images`);
    
    // Small delay between characters
    await sleep(500);
  }

  // Save results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  console.log('\n' + '=' .repeat(60));
  console.log('📊 Summary:');
  console.log(`  Total images: ${results.length}`);
  console.log(`  Output file: ${OUTPUT_FILE}`);
  console.log('');
  console.log('💡 Next steps:');
  console.log(`   1. Review ${OUTPUT_FILE}`);
  console.log(`   2. Run: npm run download:images ${OUTPUT_FILE}`);
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

