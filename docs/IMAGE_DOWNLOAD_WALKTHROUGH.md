# Complete Image Download Walkthrough

This guide walks you through the entire process of acquiring image URLs and downloading them for your gacha system.

---

## 📋 Step-by-Step Process

### Step 0: Automatic API Method (EASIEST!) ⭐ NEW!

**Use APIs to automatically fetch character images - no manual collection needed!**

#### Option A: Browse and Select Characters (EASIEST!) ⭐ RECOMMENDED

**Perfect for selecting female characters!**

1. **Browse characters for an anime**:
   ```bash
   npm run browse:characters "Spy x Family"
   ```
   This will:
   - Search for the anime on AniList
   - Show all characters with gender info
   - Let you select which characters to download
   - Filter for female characters easily

2. **Select characters**:
   - Enter numbers (e.g., "1,2,3") for specific characters
   - Enter "female" to select all female characters
   - Enter "all" to select all characters

3. **Download images**:
   ```bash
   npm run download:images selected-characters-*.json
   ```

#### Option B: From AniList API with Filters

1. **Create anime list**:
   ```bash
   npm run create:anime-list my-anime-list.json
   ```
   - Enter anime names manually
   - Optionally specify character names when prompted
   - Use `--from-anilist` to fetch from your AniList account

2. **Fetch character images (female only)**:
   ```bash
   npm run fetch:character-images my-anime-list.json --gender Female
   ```
   Or fetch specific characters:
   ```bash
   npm run fetch:character-images my-anime-list.json --characters "Yor,Anya,Power"
   ```

3. **Download images**:
   ```bash
   npm run download:images character-images.json
   ```

#### Option C: From Jikan API (MyAnimeList)

1. **Create anime list** with MAL IDs:
   ```bash
   npm run create:anime-list my-anime-list.json
   ```

2. **Fetch from Jikan**:
   ```bash
   npm run fetch:character-images my-anime-list.json --source jikan
   ```

#### Option D: Random Images from Multiple APIs ⭐ NEW!

**Get variety from multiple image APIs!**

1. **Create config file** (see `random-images-config-example.json`):
   ```json
   {
     "waifuIm": {
       "count": 20,
       "tags": ["waifu", "anime"],
       "rarity": 3
     },
     "waifuPics": {
       "count": 10,
       "category": "waifu",
       "rarity": 2
     },
     "nekos": {
       "count": 15,
       "category": "waifu",
       "rarity": 4
     }
   }
   ```

2. **Fetch random images**:
   ```bash
   npm run fetch:random-images random-config.json
   ```

**Available APIs:**
- **Waifu.im**: Tagged anime images (great variety!)
- **Waifu.pics**: Simple anime-style images
- **Nekos API**: Diverse categories (waifu, neko, kitsune, etc.)

**Benefits:**
- ✅ No manual URL collection needed!
- ✅ Gets all characters automatically
- ✅ High-quality character images
- ✅ Properly named and organized
- ✅ **Multiple API sources for variety!**

---

### Step 1: Manual Methods (If APIs don't have what you need)

There are several easy ways to get image URLs manually:

#### Method 1: Browser Extension (Easiest) ⭐ RECOMMENDED

**Use an image scraper browser extension:**

1. **Install a browser extension:**
   - Chrome: "Image Downloader" or "Bulk Image Downloader"
   - Firefox: "Download All Images"
   - Edge: "Image Downloader"

2. **Navigate to a page with images** (e.g., AniList character page, image gallery, etc.)

3. **Use the extension** to:
   - View all images on the page
   - Select images you want
   - Copy image URLs (usually "Copy URLs" or "Export URLs")

4. **Paste URLs** into a text file - one URL per line

#### Method 2: Browser DevTools (Manual)

1. **Open the page** with images you want
2. **Press F12** to open DevTools
3. **Go to Console tab**
4. **Run this JavaScript** to get all image URLs:
   ```javascript
   // Get all images on the page
   Array.from(document.querySelectorAll('img')).map(img => img.src).join('\n')
   ```
5. **Copy the output** and paste into a text file

#### Method 3: Right-Click Method (For Few Images)

1. **Right-click each image**
2. **Select "Copy image address"** or "Copy image URL"
3. **Paste into a text file** - one URL per line

#### Method 4: Inspect Element

1. **Right-click an image** → "Inspect Element"
2. **Find the `<img>` tag** in the HTML
3. **Copy the `src` attribute** value
4. **Paste into a text file**

#### Method 5: Use a Website Scraper

If you have a list of character pages or gallery pages:

1. **Use a tool like**:
   - `wget` command line tool
   - Browser extensions like "Image Grabber"
   - Online tools (be careful with privacy)

2. **Extract all image URLs** from the pages

---

### Step 2: Manual Method - Generate Template Files

Now that you have URLs, let's create template files:

1. **Open your terminal** in the project directory

2. **Generate templates**:
   ```bash
   npm run template:urls my-images
   ```

This creates 3 files:
- `my-images-template.csv` - Excel/Google Sheets format (EASIEST!)
- `my-images-template.txt` - Pipe-delimited format
- `my-images-urls-only.txt` - Just URLs (one per line)

---

### Step 3: Fill in the Template

#### Option A: Use CSV (Easiest - Recommended)

1. **Open `my-images-template.csv`** in Excel or Google Sheets
2. **You'll see columns**: `url`, `anime`, `character`, `rarity`
3. **Fill in the data**:
   - **URL column**: Paste your image URLs (one per row)
   - **Anime column**: Enter anime name (e.g., "Demon Slayer")
   - **Character column**: Enter character name (e.g., "Nezuko Kamado")
   - **Rarity column**: Enter rarity (1-5 or "Prismatic")
4. **Save the file**

**Example CSV:**
```csv
url,anime,character,rarity
https://example.com/image1.jpg,Demon Slayer,Nezuko Kamado,5
https://example.com/image2.jpg,Spy x Family,Yor Forger,4
https://example.com/image3.jpg,One Piece,Nami,3
```

#### Option B: Use Plain URLs (Quick Start)

If you just have a list of URLs:

1. **Open `my-images-urls-only.txt`**
2. **Paste your URLs** - one per line:
   ```
   https://example.com/image1.jpg
   https://example.com/image2.jpg
   https://example.com/image3.jpg
   ```
3. **Save the file**
4. **Convert to JSON** (will auto-detect from URLs):
   ```bash
   npm run convert:urls my-images-urls-only.txt my-images.json
   ```
5. **Edit the JSON file** to add correct anime/character names

#### Option C: Use Pipe-Delimited Format

1. **Open `my-images-template.txt`**
2. **Fill in format**: `url|anime|character|rarity`
   ```
   https://example.com/image1.jpg|Demon Slayer|Nezuko Kamado|5
   https://example.com/image2.jpg|Spy x Family|Yor Forger|4
   ```

---

### Step 4: Convert to JSON

Once your template is filled:

1. **Convert CSV to JSON**:
   ```bash
   npm run convert:urls my-images-template.csv my-images.json
   ```

2. **Review the output**:
   - The tool will show how many URLs were converted
   - Check `my-images.json` to make sure everything looks correct

3. **Edit if needed**:
   - Open `my-images.json` in a text editor
   - Fix any anime/character names that were auto-detected incorrectly
   - Adjust rarity values if needed

**Example JSON output:**
```json
[
  {
    "url": "https://example.com/image1.jpg",
    "anime": "Demon Slayer",
    "character": "Nezuko Kamado",
    "rarity": 5
  },
  {
    "url": "https://example.com/image2.jpg",
    "anime": "Spy x Family",
    "character": "Yor Forger",
    "rarity": 4
  }
]
```

---

### Step 5: Download Images

Now download all the images:

1. **Run the download tool**:
   ```bash
   npm run download:images my-images.json
   ```

2. **Watch the progress**:
   - The tool will download each image
   - Show progress: `[1/10] Processing: Demon Slayer > Nezuko Kamado`
   - Skip duplicates automatically
   - Optimize images if `sharp` is installed

3. **Check the summary**:
   - Shows how many successfully downloaded
   - Shows how many duplicates were skipped
   - Shows any failures

**What happens:**
- Images are downloaded to `images/gacha/[anime]/[character]/` folders
- Files are named with rarity: `character-5-1.jpg`, `character-prismatic-1.jpg`
- Duplicates are detected and skipped
- Images are validated before saving

---

### Step 6: Generate Manifest

Once images are downloaded:

1. **Generate manifest entries**:
   ```bash
   npm run generate:manifest
   ```

2. **Review the output**:
   - Creates `gacha-manifest-new.json`
   - Shows statistics (anime, characters, images)
   - Lists new/updated entries

3. **Check the manifest**:
   - Open `gacha-manifest-new.json`
   - Verify entries look correct
   - Check rarity values are correct

4. **Replace the original** (if everything looks good):
   ```bash
   # Backup original first!
   copy gacha-manifest.json gacha-manifest-backup.json
   
   # Replace with new manifest
   copy gacha-manifest-new.json gacha-manifest.json
   ```

---

### Step 7: Validate Everything

Before committing:

1. **Run validation**:
   ```bash
   npm run validate:manifest
   ```

2. **Check for errors**:
   - Broken image links
   - Missing fields
   - Invalid rarity values
   - Duplicates

3. **Fix any issues** reported

4. **Run again** to confirm everything is fixed:
   ```bash
   npm run validate:manifest
   ```

---

## 🎯 Quick Reference: Complete Workflows

### Workflow A: Automatic API Method (EASIEST!)

```bash
# 1. Create anime list (manual or from AniList)
npm run create:anime-list my-anime-list.json

# 2. Fetch character images from API
npm run fetch:character-images my-anime-list.json

# 3. Download images
npm run download:images character-images.json

# 4. Generate manifest
npm run generate:manifest

# 5. Replace & validate
copy gacha-manifest-new.json gacha-manifest.json
npm run validate:manifest
```

### Workflow B: Manual Template Method

```bash
# 1. Generate templates
npm run template:urls my-images

# 2. Fill in my-images-template.csv (use Excel/Google Sheets)

# 3. Convert to JSON
npm run convert:urls my-images-template.csv my-images.json

# 4. Download images
npm run download:images my-images.json

# 5. Generate manifest
npm run generate:manifest

# 6. Replace manifest (if everything looks good)
copy gacha-manifest-new.json gacha-manifest.json

# 7. Validate
npm run validate:manifest
```

---

## 💡 Tips for Getting URLs

### For Character Images from AniList:

1. **Go to character page** on AniList
2. **Open DevTools (F12)**
3. **Console tab**, run:
   ```javascript
   // Get all image URLs from the page
   Array.from(document.querySelectorAll('img')).map(img => img.src).filter(src => src.includes('anilist.co')).join('\n')
   ```

### For Gallery/Directory Pages:

1. **Use browser extension** "Image Downloader"
2. **Click extension icon**
3. **Select all images** you want
4. **Export URLs** to clipboard or file

### For Multiple Pages:

1. **Create a script** to visit multiple pages
2. **Use browser automation** (Selenium, Puppeteer) if you're comfortable
3. **Or manually** collect URLs from each page

### For Bulk Collection:

1. **Use a web scraper** like:
   - `wget -r -H -A jpg,jpeg,png,gif -nd [URL]`
   - Or browser extensions that can scrape multiple pages

---

## ⚠️ Important Notes

1. **Copyright**: Make sure you have permission to download images
2. **Rate Limiting**: The tool has a 500ms delay between downloads to avoid rate limiting
3. **File Size**: Maximum file size is 5MB (configurable in script)
4. **Formats Supported**: JPG, PNG, GIF, WebP
5. **Duplicate Detection**: Uses MD5 hashing - very accurate
6. **Image Optimization**: Install `sharp` for automatic optimization:
   ```bash
   npm install --save-dev sharp
   ```

---

## 🐛 Troubleshooting

### Issue: "Failed to download" errors

**Solutions:**
- Check if URLs are accessible (try opening in browser)
- Some sites block automated downloads - you may need to download manually
- Check network connection
- Verify URLs are complete (not truncated)

### Issue: "Duplicate detected" for different images

**Solutions:**
- This is rare but possible if images are identical
- Check the hash cache: `.image-hashes.json`
- Clear hash cache if needed: delete `.image-hashes.json`

### Issue: "Invalid image" errors

**Solutions:**
- Check file size (max 5MB)
- Verify format is supported (JPG, PNG, GIF, WebP)
- Check if URL points to actual image (not HTML page)

### Issue: Images not appearing after download

**Solutions:**
- Run `npm run generate:manifest` to update manifest
- Check folder structure: `images/gacha/[anime]/[character]/`
- Verify file permissions
- Run `npm run validate:manifest` to check for issues

---

## 📊 Example: Complete Session

```bash
# 1. Generate templates
$ npm run template:urls my-images
✅ CSV template: my-images-template.csv
✅ Pipe-delimited template: my-images-template.txt
✅ URLs-only template: my-images-urls-only.txt

# 2. (Fill in my-images-template.csv in Excel)

# 3. Convert to JSON
$ npm run convert:urls my-images-template.csv my-images.json
🔄 Converting URLs to JSON format...
📖 Reading: my-images-template.csv
✅ Converted 10 URLs to JSON format
📄 Output: my-images.json

# 4. Download images
$ npm run download:images my-images.json
🚀 Starting Image Download & Organization
[1/10] Processing: Demon Slayer > Nezuko Kamado
  📥 Downloading: https://example.com/image1.jpg
  ✅ Saved: demon-slayer/nezuko-kamado/nezuko-kamado-5-1.jpg
...
📊 Summary:
  ✅ Successfully downloaded: 8
  ⚠️  Duplicates skipped: 2
  ❌ Failed: 0

# 5. Generate manifest
$ npm run generate:manifest
🔍 Scanning images directory...
✅ demon-slayer/nezuko-kamado: 3 images
📊 Statistics:
  Anime: 1
  Characters: 1
  Total Images: 3

# 6. Validate
$ npm run validate:manifest
✅ All validations passed! No issues found.
```

---

*Last Updated: [Current Date]*

