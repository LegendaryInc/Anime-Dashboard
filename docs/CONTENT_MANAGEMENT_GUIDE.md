# Content Management Guide

This guide explains how to use the content management tools to validate and manage your gacha manifests and images.

---

## 🛠️ Available Tools

### 1. **Convert URLs to JSON** (`npm run convert:urls`) ⭐ EASIEST!

**Convert a list of image URLs into the JSON format needed for downloading!**

This tool makes it super easy to prepare your image list - just paste URLs in various formats and convert them.

**Supported input formats:**
- **CSV**: `url,anime,character,rarity`
- **Pipe-delimited**: `url|anime|character|rarity`
- **Tab-delimited**: `url\tanime\tcharacter\trarity`
- **Plain URLs**: One URL per line (auto-extracts info from URL)

**Usage:**

1. **Generate template files** (easiest way to start):
   ```bash
   npm run template:urls my-images
   ```
   This creates 3 template files you can fill out:
   - `my-images-template.csv` - Excel/Google Sheets compatible
   - `my-images-template.txt` - Pipe-delimited format
   - `my-images-urls-only.txt` - Just URLs (one per line)

2. **Fill in the template** with your image URLs

3. **Convert to JSON**:
   ```bash
   npm run convert:urls my-images-template.csv my-images.json
   ```

4. **Download images**:
   ```bash
   npm run download:images my-images.json
   ```

**Interactive mode** (for manual entry):
```bash
npm run convert:urls --interactive my-images.json
```
This will prompt you for each URL, anime name, character name, and rarity.

**Example CSV format:**
```csv
url,anime,character,rarity
https://example.com/image1.jpg,Demon Slayer,Nezuko Kamado,5
https://example.com/image2.jpg,Spy x Family,Yor Forger,4
```

**Example pipe-delimited format:**
```
https://example.com/image1.jpg|Demon Slayer|Nezuko Kamado|5
https://example.com/image2.jpg|Spy x Family|Yor Forger|4
```

---

### 2. **Download & Organize Images** (`npm run download:images`) ⭐ NEWEST!

**Downloads images from URLs and automatically organizes them!**

This is the easiest way to get new content - just provide a list of image URLs and the tool handles everything.

**Features:**
- ✅ Downloads images from URLs
- ✅ Organizes by anime/character automatically
- ✅ Detects duplicates (won't download same image twice)
- ✅ Names files with rarity patterns
- ✅ Validates images before saving
- ✅ Creates proper folder structure

**How it works:**
1. Create a JSON file with image URLs
2. Run the download tool
3. Images are automatically organized and named
4. Duplicates are detected and skipped
5. Generate manifest from organized images

**Image List JSON Format:**
```json
[
  {
    "url": "https://example.com/image.jpg",
    "anime": "Anime Name",
    "character": "Character Name",
    "rarity": 5
  }
]
```

**Usage:**
1. Create a JSON file with your image URLs (see `download-images-example.json` for format)
2. Run:
   ```bash
   npm run download:images images-to-download.json
   ```
3. Review downloaded images
4. Run `npm run generate:manifest` to add to manifest
5. Run `npm run validate:manifest` to check everything

**Example:**
```bash
# Download images from your list
npm run download:images my-images.json

# Generate manifest from downloaded images
npm run generate:manifest

# Validate everything
npm run validate:manifest
```

**Notes:**
- Duplicate detection uses image hashing (MD5)
- Images are validated before saving
- Files are automatically named with rarity patterns
- Creates proper folder structure automatically
- Hash cache is saved for faster duplicate detection

---

### 3. **Generate Manifest from Images** (`npm run generate:manifest`) ⭐ NEW!

**Auto-generates manifest entries from your image folders!**

This is the easiest way to add content - just drop images in folders and run this tool.

**How it works:**
1. Scans `images/gacha/[anime]/[character]/` directories
2. Auto-detects rarity from filenames (e.g., `character-5.jpg` = rarity 5)
3. Generates manifest entries automatically
4. Merges with existing manifest (won't overwrite your existing entries)

**Supported filename patterns for rarity:**
- `character-5.jpg` → rarity 5
- `character-prismatic.jpg` → Prismatic
- `character-legendary.jpg` → rarity 5
- `character-epic.jpg` → rarity 4
- `character-rare.jpg` → rarity 3
- `character-common.jpg` → rarity 2
- Default → rarity 2

**Usage:**
```bash
npm run generate:manifest
```

**Output:**
- Creates `data/gacha-manifest-new.json` (review this before replacing original)
- Shows statistics (anime, characters, images)
- Lists new/updated entries

**Workflow:**
1. Drop images into `images/gacha/[anime]/[character]/` folders
2. Run `npm run generate:manifest`
3. Review `data/gacha-manifest-new.json`
4. Run `npm run validate:manifest` to check
5. If everything looks good, replace `gacha-manifest.json` with the new file:
   ```bash
   copy data\gacha-manifest-new.json gacha-manifest.json
   ```

---

### 4. **Organize Images** (`npm run organize:images`) ⭐ NEW!

**Helps organize images into the proper folder structure**

**How it works:**
- Reads images from `images/to-organize/` folder
- Parses filenames to extract anime/character names
- Creates proper folder structure
- Copies/moves images to correct location

**Supported filename patterns:**
- `anime_character_variant.jpg` → `images/gacha/anime/character/variant.jpg`
- `anime-character-variant.jpg` → `images/gacha/anime/character/variant.jpg`
- `anime character variant.jpg` → `images/gacha/anime/character/variant.jpg`

**Usage:**
1. Put images to organize in `images/to-organize/` folder
2. Name them with pattern: `[anime]_[character]_[variant].jpg`
3. Run:
   ```bash
   npm run organize:images
   ```

**Note:** Edit `scripts/organize-images.js` to change `SOURCE_DIR` if you want to use a different folder.

---

### 5. **Manifest Validation** (`npm run validate:manifest`)

Validates your `gacha-manifest.json` and `cosmetics-manifest.json` files.

**What it checks:**
- ✅ Broken image links
- ✅ Missing required fields (path, rarity, etc.)
- ✅ Invalid rarity values
- ✅ Duplicate entries
- ✅ JSON structure errors

**Usage:**
```bash
npm run validate:manifest
```

**Output:**
- Detailed statistics (total anime, characters, cards)
- List of all errors found
- List of warnings
- Exit code 0 = success, 1 = errors found

**Example Output:**
```
✅ All validations passed! No issues found.
```

---

### 6. **Image List Tool** (`npm run list:images`)

Lists all images in your manifest and checks which ones exist on disk.

**What it does:**
- Lists all images referenced in the manifest
- Checks which images actually exist
- Reports missing images with full paths
- Generates report files

**Usage:**
```bash
npm run list:images
```

**Output Files:**
- `image-list.txt` - Simple list of all image paths
- `image-report.json` - Detailed JSON report with:
  - Total images
  - Existing images count
  - Missing images count
  - Missing image details (path, anime, character)
  - Full list of all images

---

## 📋 Workflow for Adding New Content

### 🎯 EASIEST WAY: Generate Template → Fill → Download

1. **Generate template files**:
   ```bash
   npm run template:urls my-images
   ```

2. **Fill in the template** (CSV is easiest - use Excel/Google Sheets):
   - Open `my-images-template.csv`
   - Add your image URLs, anime names, character names, and rarities
   - Save the file

3. **Convert to JSON**:
   ```bash
   npm run convert:urls my-images-template.csv my-images.json
   ```

4. **Download images**:
   ```bash
   npm run download:images my-images.json
   ```
   (Output will be saved to `data/character-images.json`)

5. **Generate manifest**:
   ```bash
   npm run generate:manifest
   ```
   (Creates `data/gacha-manifest-new.json`)

6. **Review and replace manifest**:
   ```bash
   # Review the new manifest
   type data\gacha-manifest-new.json
   
   # If everything looks good, replace the old one
   copy data\gacha-manifest-new.json gacha-manifest.json
   ```

7. **Validate**:
   ```bash
   npm run validate:manifest
   ```

### Alternative: Quick URL List

If you just have a list of URLs:

1. **Create a text file** with one URL per line:
   ```
   https://example.com/image1.jpg
   https://example.com/image2.jpg
   ```

2. **Convert to JSON** (will auto-extract info from URLs):
   ```bash
   npm run convert:urls my-urls.txt my-images.json
   ```

3. **Edit the JSON** to add correct anime/character names

4. **Download images**:
   ```bash
   npm run download:images my-images.json
   ```
   (Output will be saved to `data/character-images.json` if using the fetch tools)

### Alternative: Auto-Generate from Images

1. **Drop images** into `images/gacha/[anime]/[character]/` folders
   - Example: `images/gacha/5-toubun-no-hanayome/miku-nakano/miku-1.jpg`
   
2. **Name images with rarity** (optional but recommended):
   - `character-1.jpg` → rarity 1
   - `character-5.jpg` → rarity 5
   - `character-prismatic.jpg` → Prismatic
   
3. **Generate manifest automatically**:
   ```bash
   npm run generate:manifest
   ```
   
4. **Review** the generated `data/gacha-manifest-new.json`
   
5. **Validate** everything:
   ```bash
   npm run validate:manifest
   ```
   
6. **Replace** `gacha-manifest.json` with `data/gacha-manifest-new.json` if everything looks good:
   ```bash
   copy data\gacha-manifest-new.json gacha-manifest.json
   ```

### Alternative: Organize Images First

If you have a bunch of images with consistent naming:

1. **Put images** in `images/to-organize/` folder
   - Name them: `anime_character_variant.jpg`
   - Example: `5-toubun-no-hanayome_miku-nakano_miku-1.jpg`
   
2. **Organize automatically**:
   ```bash
   npm run organize:images
   ```
   
3. **Then generate manifest**:
   ```bash
   npm run generate:manifest
   ```

### Manual Method (Old Way):

1. **Add images to** `images/gacha/[anime]/[character]/` directory
2. **Manually update** `gacha-manifest.json` with new entries
3. **Run validation** to check for errors:
   ```bash
   npm run validate:manifest
   ```

4. **Check for missing images**:
   ```bash
   npm run list:images
   ```

5. **Review** `image-report.json` for any missing files

### When Adding New Packs:

1. **Add pack images** to `cosmetics/packs/[pack-name]/` directory
2. **Update** `cosmetics-manifest.json` with new pack entry
3. **Run validation** to check pack structure:
   ```bash
   npm run validate:manifest
   ```

---

## 🔍 Common Issues & Solutions

### Issue: "Broken image" error

**Solution:**
1. Check the image path in the manifest
2. Verify the file exists at that location
3. Check file name spelling/capitalization
4. Ensure path uses forward slashes (`/`) not backslashes

### Issue: "Invalid rarity" error

**Solution:**
Valid rarity values are:
- Numbers: `1`, `2`, `3`, `4`, `5`
- Strings: `"Prismatic"`, `"Legendary"`, `"Epic"`, `"Rare"`, `"Common"`

### Issue: "Missing field" error

**Solution:**
Ensure each variant has:
- `path` - Image file path
- `rarity` - Rarity value (1-5 or Prismatic)

### Issue: Images not found

**Solution:**
1. Run `npm run list:images`
2. Check `image-report.json` for missing images
3. Verify file paths match the manifest
4. Check file permissions

---

## 📁 File Structure

```
project-root/
├── gacha-manifest.json       # Main gacha card manifest
├── cosmetics-manifest.json    # Cosmetic packs manifest
├── images/
│   └── gacha/
│       └── [anime-name]/
│           └── [character-name]/
│               └── [image-files].jpg
└── cosmetics/
    └── packs/
        └── [pack-name]/
            └── [cosmetic-files].png
```

---

## 🎯 Best Practices

1. **Always validate before committing** - Run `npm run validate:manifest` before pushing changes
2. **Use consistent naming** - Keep anime/character names consistent across manifest
3. **Check images first** - Verify images exist before adding to manifest
4. **Test incrementally** - Add a few images, validate, then add more
5. **Keep backups** - Backup your manifest files before making bulk changes

---

## 🚀 Quick Commands Reference

```bash
# Generate template files (START HERE!)
npm run template:urls my-images

# Convert URLs to JSON format
npm run convert:urls my-images.csv my-images.json

# Interactive mode (manual entry)
npm run convert:urls --interactive my-images.json

# Download images from URLs
npm run download:images my-images.json

# Generate manifest from images
npm run generate:manifest

# Organize images into proper folders
npm run organize:images

# Validate everything
npm run validate:manifest

# List all images and check status
npm run list:images

# Complete workflow (recommended)
npm run template:urls my-images && \
npm run convert:urls my-images-template.csv my-images.json && \
npm run download:images my-images.json && \
npm run generate:manifest && \
npm run validate:manifest
```

---

## 💡 Tips

- **Use auto-generation** - `npm run generate:manifest` is the easiest way to add content!
- **Name images with rarity** - Use patterns like `character-5.jpg` for easy detection
- **Organize first** - Use `npm run organize:images` if you have many images to organize
- **Validate regularly** - Run `npm run validate:manifest` before committing
- **Check report files** - `image-report.json` has detailed info
- **Fix one error at a time** - Don't try to fix everything at once
- **Keep folder structure consistent** - Use `anime-character` format for folder names
- **Document your changes** - Note what you added/changed

---

*Last Updated: [Current Date]*

