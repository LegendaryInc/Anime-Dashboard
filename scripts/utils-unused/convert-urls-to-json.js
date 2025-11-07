/**
 * URL to JSON Converter Tool
 * 
 * Converts various input formats to the image download JSON format
 * Supports:
 * - Plain text file with URLs (one per line)
 * - CSV file with columns: url,anime,character,rarity
 * - Pipe-delimited format: url|anime|character|rarity
 * - Interactive mode: prompts for each URL
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Parse different input formats
 */
function parseInput(inputFile, format = 'auto') {
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ File not found: ${inputFile}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(inputFile, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const results = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue; // Skip empty lines and comments
    
    let item = null;
    
    // Try CSV format first (url,anime,character,rarity)
    if (line.includes(',')) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        item = {
          url: parts[0],
          anime: parts[1],
          character: parts[2],
          rarity: parts[3] ? (isNaN(parts[3]) ? parts[3] : parseInt(parts[3])) : 2
        };
      }
    }
    // Try pipe-delimited format (url|anime|character|rarity)
    else if (line.includes('|')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 3) {
        item = {
          url: parts[0],
          anime: parts[1],
          character: parts[2],
          rarity: parts[3] ? (isNaN(parts[3]) ? parts[3] : parseInt(parts[3])) : 2
        };
      }
    }
    // Try tab-delimited format
    else if (line.includes('\t')) {
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length >= 3) {
        item = {
          url: parts[0],
          anime: parts[1],
          character: parts[2],
          rarity: parts[3] ? (isNaN(parts[3]) ? parts[3] : parseInt(parts[3])) : 2
        };
      }
    }
    // Plain URL - try to extract info from URL or use defaults
    else if (line.startsWith('http://') || line.startsWith('https://')) {
      // Try to extract anime/character from URL path
      try {
        const url = new URL(line);
        const pathParts = url.pathname.split('/').filter(p => p);
        
        // Try common patterns
        let anime = 'Unknown';
        let character = 'Unknown';
        
        // Pattern: /anime/character/image.jpg
        if (pathParts.length >= 3) {
          anime = pathParts[pathParts.length - 3].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          character = pathParts[pathParts.length - 2].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        // Pattern: /images/anime-character.jpg
        else if (pathParts.length >= 1) {
          const filename = pathParts[pathParts.length - 1];
          const parts = filename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '').split('-');
          if (parts.length >= 2) {
            anime = parts.slice(0, -1).join(' ').replace(/\b\w/g, l => l.toUpperCase());
            character = parts[parts.length - 1].replace(/\b\w/g, l => l.toUpperCase());
          }
        }
        
        item = {
          url: line,
          anime: anime,
          character: character,
          rarity: 2 // Default
        };
      } catch (error) {
        // Invalid URL, skip
        console.log(`⚠️  Skipping invalid URL on line ${i + 1}: ${line}`);
        continue;
      }
    }
    
    if (item && item.url) {
      results.push(item);
    }
  }
  
  return results;
}

/**
 * Interactive mode - prompt for each URL
 */
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (query) => new Promise((resolve) => rl.question(query, resolve));
  
  const results = [];
  let continueInput = true;
  
  console.log('📝 Interactive Mode - Enter image URLs (press Enter without input to finish)\n');
  
  while (continueInput) {
    const url = await question('Image URL: ');
    if (!url.trim()) {
      continueInput = false;
      break;
    }
    
    const anime = await question('Anime name: ');
    if (!anime.trim()) {
      console.log('⚠️  Skipping - anime name required');
      continue;
    }
    
    const character = await question('Character name: ');
    if (!character.trim()) {
      console.log('⚠️  Skipping - character name required');
      continue;
    }
    
    const rarityInput = await question('Rarity (1-5 or Prismatic, default 2): ');
    let rarity = 2;
    if (rarityInput.trim()) {
      if (rarityInput.toLowerCase() === 'prismatic') {
        rarity = 'Prismatic';
      } else {
        const num = parseInt(rarityInput);
        if (!isNaN(num) && num >= 1 && num <= 5) {
          rarity = num;
        }
      }
    }
    
    results.push({
      url: url.trim(),
      anime: anime.trim(),
      character: character.trim(),
      rarity: rarity
    });
    
    console.log(`✅ Added: ${anime} > ${character} (rarity: ${rarity})\n`);
  }
  
  rl.close();
  return results;
}

/**
 * Generate template file
 */
function generateTemplate(outputFile) {
  const templates = {
    csv: `url,anime,character,rarity
https://example.com/image1.jpg,Demon Slayer,Nezuko Kamado,5
https://example.com/image2.jpg,Spy x Family,Yor Forger,4
https://example.com/image3.jpg,One Piece,Nami,3`,
    
    pipe: `url|anime|character|rarity
https://example.com/image1.jpg|Demon Slayer|Nezuko Kamado|5
https://example.com/image2.jpg|Spy x Family|Yor Forger|4
https://example.com/image3.jpg|One Piece|Nami|3`,
    
    urls: `# Plain URLs - one per line
# The tool will try to extract anime/character from URL, but you may need to edit the JSON
https://example.com/images/demon-slayer/nezuko-kamado/image1.jpg
https://example.com/images/spy-x-family/yor-forger/image2.jpg
https://example.com/images/one-piece/nami/image3.jpg`
  };
  
  console.log('📄 Generating template files...\n');
  
  // Generate CSV template
  const csvFile = outputFile.replace(/\.(json|txt)$/, '-template.csv');
  fs.writeFileSync(csvFile, templates.csv);
  console.log(`✅ CSV template: ${csvFile}`);
  
  // Generate pipe-delimited template
  const pipeFile = outputFile.replace(/\.(json|txt)$/, '-template.txt');
  fs.writeFileSync(pipeFile, templates.pipe);
  console.log(`✅ Pipe-delimited template: ${pipeFile}`);
  
  // Generate URLs-only template
  const urlsFile = outputFile.replace(/\.(json|txt)$/, '-urls-only.txt');
  fs.writeFileSync(urlsFile, templates.urls);
  console.log(`✅ URLs-only template: ${urlsFile}`);
  
  console.log('\n💡 Fill in the template files and run:');
  console.log(`   node scripts/convert-urls-to-json.js <template-file> <output.json>`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('📋 URL to JSON Converter Tool\n');
    console.log('Usage:');
    console.log('  node scripts/convert-urls-to-json.js <input-file> <output.json>');
    console.log('  node scripts/convert-urls-to-json.js --template <output-name>');
    console.log('  node scripts/convert-urls-to-json.js --interactive <output.json>');
    console.log('');
    console.log('Input formats supported:');
    console.log('  1. CSV: url,anime,character,rarity');
    console.log('  2. Pipe-delimited: url|anime|character|rarity');
    console.log('  3. Tab-delimited: url\\tanime\\tcharacter\\trarity');
    console.log('  4. Plain URLs: one URL per line (auto-extracts info)');
    console.log('');
    console.log('Examples:');
    console.log('  # Generate template files');
    console.log('  node scripts/convert-urls-to-json.js --template my-images');
    console.log('');
    console.log('  # Convert CSV to JSON');
    console.log('  node scripts/convert-urls-to-json.js my-images.csv my-images.json');
    console.log('');
    console.log('  # Interactive mode');
    console.log('  node scripts/convert-urls-to-json.js --interactive my-images.json');
    console.log('');
    process.exit(0);
  }
  
  // Generate template
  if (args[0] === '--template' || args[0] === '-t') {
    const outputName = args[1] || 'images';
    generateTemplate(`${outputName}.json`);
    process.exit(0);
  }
  
  // Interactive mode
  if (args[0] === '--interactive' || args[0] === '-i') {
    const outputFile = args[1] || 'images.json';
    const results = await interactiveMode();
    
    if (results.length > 0) {
      fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
      console.log(`\n✅ Saved ${results.length} images to: ${outputFile}`);
      console.log(`💡 Run: npm run download:images ${outputFile}`);
    } else {
      console.log('\n⚠️  No images added');
    }
    process.exit(0);
  }
  
  // File conversion mode
  const inputFile = args[0];
  const outputFile = args[1] || inputFile.replace(/\.[^.]+$/, '.json');
  
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    process.exit(1);
  }
  
  console.log('🔄 Converting URLs to JSON format...\n');
  console.log(`📖 Reading: ${inputFile}`);
  
  const results = parseInput(inputFile);
  
  if (results.length === 0) {
    console.log('⚠️  No valid URLs found in input file');
    console.log('💡 Try: node scripts/convert-urls-to-json.js --template my-images');
    process.exit(1);
  }
  
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  
  console.log(`✅ Converted ${results.length} URLs to JSON format`);
  console.log(`📄 Output: ${outputFile}`);
  console.log('');
  console.log('💡 Next steps:');
  console.log(`   1. Review ${outputFile} and edit if needed`);
  console.log(`   2. Run: npm run download:images ${outputFile}`);
  console.log('');
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

