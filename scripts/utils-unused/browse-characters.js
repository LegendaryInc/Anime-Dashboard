/**
 * Browse and Select Characters Tool
 * 
 * Fetches characters from AniList for an anime and lets you select which ones to download
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ANILIST_API = 'https://graphql.anilist.co';
const ANILIST_DELAY = 1000;

let lastAnilistRequest = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search anime on AniList
 */
async function searchAniListAnime(animeName) {
  const query = `
    query ($search: String) {
      Page(perPage: 10) {
        media(search: $search, type: ANIME) {
          id
          title {
            romaji
            english
          }
        }
      }
    }
  `;

  const now = Date.now();
  const timeSinceLastRequest = now - lastAnilistRequest;
  if (timeSinceLastRequest < ANILIST_DELAY) {
    await sleep(ANILIST_DELAY - timeSinceLastRequest);
  }

  try {
    lastAnilistRequest = Date.now();
    const response = await axios.post(ANILIST_API, {
      query: query,
      variables: { search: animeName }
    });

    return response.data?.data?.Page?.media || [];
  } catch (error) {
    console.error(`❌ AniList search error:`, error.message);
    return [];
  }
}

/**
 * Fetch characters from AniList
 */
async function fetchAniListCharacters(animeId) {
  const query = `
    query ($id: Int) {
      Media(id: $id) {
        title {
          romaji
          english
        }
        characters(perPage: 50) {
          nodes {
            id
            name {
              full
              native
            }
            image {
              large
              medium
            }
            gender
            description
          }
        }
      }
    }
  `;

  const now = Date.now();
  const timeSinceLastRequest = now - lastAnilistRequest;
  if (timeSinceLastRequest < ANILIST_DELAY) {
    await sleep(ANILIST_DELAY - timeSinceLastRequest);
  }

  try {
    lastAnilistRequest = Date.now();
    const response = await axios.post(ANILIST_API, {
      query: query,
      variables: { id: animeId }
    });

    const media = response.data?.data?.Media;
    if (!media) return null;

    return {
      anime: {
        id: animeId,
        title: media.title.english || media.title.romaji,
        romaji: media.title.romaji
      },
      characters: media.characters.nodes.map(char => ({
        id: char.id,
        name: char.name.full,
        nativeName: char.name.native,
        imageUrl: char.image.large || char.image.medium,
        gender: char.gender || 'Unknown',
        description: char.description
      }))
    };
  } catch (error) {
    console.error(`❌ AniList error:`, error.message);
    return null;
  }
}

/**
 * Interactive character selection
 */
async function selectCharacters(anime, characters) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  console.log(`\n📋 Found ${characters.length} characters for "${anime.title}"\n`);
  
  // Filter for female characters first
  const femaleCharacters = characters.filter(char => {
    const gender = char.gender?.toLowerCase();
    return gender === 'female' || gender === 'f';
  });

  if (femaleCharacters.length > 0) {
    console.log(`👩 Female characters (${femaleCharacters.length}):`);
    femaleCharacters.forEach((char, idx) => {
      console.log(`  ${idx + 1}. ${char.name} (${char.nativeName || 'N/A'}) - ${char.gender}`);
    });
    console.log('');
  }

  const maleCharacters = characters.filter(char => {
    const gender = char.gender?.toLowerCase();
    return gender === 'male' || gender === 'm';
  });

  if (maleCharacters.length > 0) {
    console.log(`👨 Male characters (${maleCharacters.length}):`);
    maleCharacters.forEach((char, idx) => {
      console.log(`  ${femaleCharacters.length + idx + 1}. ${char.name} (${char.nativeName || 'N/A'}) - ${char.gender}`);
    });
    console.log('');
  }

  const unknownCharacters = characters.filter(char => {
    const gender = char.gender?.toLowerCase();
    return !gender || (gender !== 'female' && gender !== 'f' && gender !== 'male' && gender !== 'm');
  });

  if (unknownCharacters.length > 0) {
    console.log(`❓ Unknown gender (${unknownCharacters.length}):`);
    unknownCharacters.forEach((char, idx) => {
      console.log(`  ${femaleCharacters.length + maleCharacters.length + idx + 1}. ${char.name} (${char.nativeName || 'N/A'})`);
    });
    console.log('');
  }

  console.log('Selection options:');
  console.log('  - Enter numbers separated by commas (e.g., "1,2,3")');
  console.log('  - Enter "all" to select all characters');
  console.log('  - Enter "female" to select all female characters');
  console.log('  - Enter "skip" to skip this anime');
  console.log('');

  const selection = await question('Select characters: ');

  rl.close();

  if (selection.toLowerCase() === 'skip') {
    return [];
  }

  if (selection.toLowerCase() === 'all') {
    return characters;
  }

  if (selection.toLowerCase() === 'female') {
    return femaleCharacters.length > 0 ? femaleCharacters : characters;
  }

  // Parse number selection
  const selectedIndices = selection.split(',').map(s => parseInt(s.trim()) - 1).filter(n => !isNaN(n) && n >= 0 && n < characters.length);
  return selectedIndices.map(idx => characters[idx]);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('🎴 Browse and Select Characters Tool\n');
    console.log('Usage:');
    console.log('  node scripts/browse-characters.js <anime-name>');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/browse-characters.js "Spy x Family"');
    console.log('');
    console.log('This tool will:');
    console.log('  1. Search for the anime on AniList');
    console.log('  2. Show you all characters');
    console.log('  3. Let you select which characters to download');
    console.log('  4. Generate a JSON file ready for download');
    console.log('');
    process.exit(0);
  }

  const animeName = args.join(' ');
  
  console.log('🔍 Searching for anime...\n');
  const searchResults = await searchAniListAnime(animeName);

  if (searchResults.length === 0) {
    console.log('❌ No anime found');
    process.exit(1);
  }

  console.log('📋 Search results:');
  searchResults.forEach((anime, idx) => {
    console.log(`  ${idx + 1}. ${anime.title.english || anime.title.romaji} (ID: ${anime.id})`);
  });
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  const selectedIdx = await question('Select anime (enter number): ');
  const selectedAnime = searchResults[parseInt(selectedIdx) - 1];

  if (!selectedAnime) {
    console.log('❌ Invalid selection');
    rl.close();
    process.exit(1);
  }

  rl.close();

  console.log(`\n📥 Fetching characters for "${selectedAnime.title.english || selectedAnime.title.romaji}"...\n`);
  
  const data = await fetchAniListCharacters(selectedAnime.id);

  if (!data || data.characters.length === 0) {
    console.log('❌ No characters found');
    process.exit(1);
  }

  const selectedCharacters = await selectCharacters(data.anime, data.characters);

  if (selectedCharacters.length === 0) {
    console.log('⚠️  No characters selected');
    process.exit(0);
  }

  // Generate output
  const output = selectedCharacters.map(char => ({
    url: char.imageUrl,
    anime: data.anime.title,
    character: char.name,
    rarity: 2, // Default rarity
    source: 'anilist',
    characterId: char.id,
    gender: char.gender
  }));

  const outputFile = path.join(__dirname, '..', `selected-characters-${Date.now()}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

  console.log(`\n✅ Selected ${selectedCharacters.length} characters`);
  console.log(`📁 Saved to: ${outputFile}`);
  console.log('');
  console.log('💡 Next steps:');
  console.log(`   npm run download:images ${outputFile}`);
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

