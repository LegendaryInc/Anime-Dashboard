/**
 * Create Anime List Tool
 * 
 * Helps create an anime list file for fetching character images
 * Can use AniList data or manual input
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const ANILIST_API = 'https://graphql.anilist.co';

/**
 * Fetch user's anime list from AniList
 */
async function fetchUserAnimeList(accessToken) {
  const query = `
    query ($userId: Int) {
      MediaListCollection(userId: $userId, type: ANIME) {
        lists {
          entries {
            media {
              id
              idMal
              title {
                romaji
                english
              }
            }
          }
        }
      }
    }
  `;

  try {
    // Get user ID first
    const viewerResp = await axios.post(
      ANILIST_API,
      { query: `query { Viewer { id } }` },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const userId = viewerResp.data?.data?.Viewer?.id;

    // Get anime list
    const listResp = await axios.post(
      ANILIST_API,
      { query: query, variables: { userId } },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const lists = listResp.data?.data?.MediaListCollection?.lists || [];
    const entries = lists.flatMap(l => l.entries || []);

    return entries.map(entry => ({
      animeName: entry.media.title.english || entry.media.title.romaji,
      animeId: entry.media.id,
      malId: entry.media.idMal
    }));
  } catch (error) {
    console.error('Error fetching AniList data:', error.message);
    return null;
  }
}

/**
 * Create anime list from manual input
 */
function createManualList() {
  console.log('\n📝 Manual Entry Mode\n');
  console.log('Enter anime information (press Enter without input to finish)\n');

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  const animeList = [];
  let continueInput = true;

  (async () => {
    while (continueInput) {
      const animeName = await question('Anime name: ');
      if (!animeName.trim()) {
        continueInput = false;
        break;
      }

      const animeIdInput = await question('AniList ID (optional, press Enter to skip): ');
      const malIdInput = await question('MAL ID (optional, press Enter to skip): ');
      const rarityInput = await question('Default rarity for characters (1-5, default 2): ');
      const charactersInput = await question('Specific characters (comma-separated, press Enter for all): ');

      const animeId = animeIdInput.trim() ? parseInt(animeIdInput) : null;
      const malId = malIdInput.trim() ? parseInt(malIdInput) : null;
      const rarity = rarityInput.trim() ? parseInt(rarityInput) : 2;
      const characters = charactersInput.trim() ? 
        charactersInput.split(',').map(c => c.trim()).filter(c => c) : null;

      animeList.push({
        animeName: animeName.trim(),
        animeId: animeId,
        malId: malId,
        rarity: rarity,
        characters: characters
      });

      console.log(`✅ Added: ${animeName}${characters ? ` (${characters.length} characters)` : ''}\n`);
    }

    rl.close();
    return animeList;
  })();
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('📋 Create Anime List Tool\n');
    console.log('Usage:');
    console.log('  node scripts/create-anime-list.js <output.json> [--from-anilist]');
    console.log('');
    console.log('Options:');
    console.log('  --from-anilist  Fetch anime list from your AniList account');
    console.log('                  (requires access token in .env or as argument)');
    console.log('');
    console.log('Examples:');
    console.log('  # Manual entry');
    console.log('  node scripts/create-anime-list.js my-anime-list.json');
    console.log('');
    console.log('  # From AniList');
    console.log('  node scripts/create-anime-list.js my-anime-list.json --from-anilist');
    console.log('');
    console.log('Output format:');
    console.log(JSON.stringify([
      {
        "animeName": "Demon Slayer",
        "animeId": 101348,
        "malId": 38000,
        "rarity": 5,
        "characters": ["Nezuko", "Shinobu"]  // Optional: specific characters
      }
    ], null, 2));
    console.log('');
    process.exit(0);
  }

  const outputFile = args[0];
  const fromAnilist = args.includes('--from-anilist');

  let animeList = [];

  if (fromAnilist) {
    // Try to get access token from env or session
    const accessToken = process.env.ANILIST_ACCESS_TOKEN;
    
    if (!accessToken) {
      console.log('⚠️  No AniList access token found');
      console.log('💡 Set ANILIST_ACCESS_TOKEN in .env file');
      console.log('💡 Or use manual entry mode instead');
      process.exit(1);
    }

    console.log('📥 Fetching anime list from AniList...\n');
    animeList = await fetchUserAnimeList(accessToken);
    
    if (!animeList || animeList.length === 0) {
      console.log('⚠️  No anime found or error occurred');
      process.exit(1);
    }

    console.log(`✅ Found ${animeList.length} anime\n`);
  } else {
    // Manual entry mode
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    console.log('📝 Manual Entry Mode');
    console.log('Enter anime information (press Enter without input to finish)\n');

    let continueInput = true;

    while (continueInput) {
      const animeName = await question('Anime name: ');
      if (!animeName.trim()) {
        continueInput = false;
        break;
      }

      const animeIdInput = await question('AniList ID (optional, press Enter to skip): ');
      const malIdInput = await question('MAL ID (optional, press Enter to skip): ');
      const rarityInput = await question('Default rarity for characters (1-5, default 2): ');
      const charactersInput = await question('Specific characters (comma-separated, press Enter for all): ');

      const animeId = animeIdInput.trim() ? parseInt(animeIdInput) : null;
      const malId = malIdInput.trim() ? parseInt(malIdInput) : null;
      const rarity = rarityInput.trim() ? parseInt(rarityInput) : 2;
      const characters = charactersInput.trim() ? 
        charactersInput.split(',').map(c => c.trim()).filter(c => c) : null;

      animeList.push({
        animeName: animeName.trim(),
        animeId: animeId,
        malId: malId,
        rarity: rarity,
        characters: characters
      });

      console.log(`✅ Added: ${animeName}${characters ? ` (${characters.length} characters)` : ''}\n`);
    }

    rl.close();
  }

  // Save to file
  fs.writeFileSync(outputFile, JSON.stringify(animeList, null, 2));

  console.log('');
  console.log('=' .repeat(60));
  console.log(`✅ Saved ${animeList.length} anime to: ${outputFile}`);
  console.log('');
  console.log('💡 Next steps:');
  console.log(`   1. Review ${outputFile}`);
  console.log(`   2. Run: node scripts/fetch-character-images.js ${outputFile}`);
  console.log(`   3. Or: node scripts/fetch-character-images.js ${outputFile} --source jikan`);
  console.log('');
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

