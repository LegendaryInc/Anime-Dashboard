# Complete Walkthrough: Getting Images for Your 20 Characters

This guide walks you through getting images for your specific 20 characters from their anime.

---

## 📋 Your Characters List

I've created a JSON file (`my-characters-list.json`) with all your characters organized by anime. Here they are:

**Re:Zero:**
- Rem
- Emilia

**Sword Art Online:**
- Asuna Yuuki

**Attack on Titan:**
- Mikasa Ackerman

**Darling in the Franxx:**
- Zero Two

**KonoSuba:**
- Megumin

**Steins;Gate:**
- Kurisu Makise

**Future Diary:**
- Yuno Gasai

**Kaguya-sama: Love Is War:**
- Kaguya Shinomiya

**Spy x Family:**
- Yor Forger

**Naruto:**
- Hinata Hyuga
- Tsunade

**Rascal Does Not Dream of Bunny Girl Senpai:**
- Mai Sakurajima

**High School DxD:**
- Rias Gremory

**Fate/stay night:**
- Saber

**A Certain Scientific Railgun:**
- Mikoto Misaka

**One Piece:**
- Nami

**Fairy Tail:**
- Erza Scarlet

**Spice and Wolf:**
- Holo

**Demon Slayer:**
- Nezuko Kamado

---

## 🚀 Method 1: Quick Bulk Method (RECOMMENDED)

**This is the fastest way to get all 20 characters at once!**

### Step 1: Review the JSON File

I've already created `my-characters-list.json` with all your characters. You can edit it if needed:

```json
[
  {
    "animeName": "Re:Zero − Starting Life in Another World",
    "characters": ["Rem", "Emilia"],
    "rarity": 5
  },
  ...
]
```

### Step 2: Fetch Character Images

**Option A: Single image per character (default)**
```bash
npm run fetch:character-images my-characters-list.json
```

**Option B: Multiple images per character with randomized rarity** ⭐ RECOMMENDED
```bash
npm run fetch:character-images my-characters-list.json --images-per-character 3 --randomize-rarity
```

**Option C: Combine multiple APIs for maximum variety** ⭐ BEST VARIETY!
```bash
npm run fetch:character-images my-characters-list.json --combine-apis --additional-images 2 --randomize-rarity
```

This will:
- Get character images from AniList (official character images)
- **Plus** get additional random images from Waifu.im, Waifu.pics, and Nekos APIs
- **Create variety** with both official and random images
- **Randomize rarity** (weighted: 60% 2-star, 30% 3-star, 8% 4-star, 1.9% 5-star, 0.1% Prismatic)
- Generate `character-images.json` ready for download

**Available options:**
- `--images-per-character NUM` - How many images per character from main API (default: 1)
- `--combine-apis` - Combine main API (AniList/Jikan) with random APIs
- `--additional-images NUM` - How many additional images per character from random APIs
- `--random-apis LIST` - Which random APIs to use (e.g., "waifu-im,waifu-pics,nekos")
- `--randomize-rarity` - Randomize rarity instead of using base rarity
- `--gender Female` - Filter for female characters only
- `--source SOURCE` - Main API source (anilist, jikan)

**API Options:**
- **anilist** - Official character images from AniList (best quality)
- **jikan** - Character images from MyAnimeList
- **waifu-im** - Tagged anime images (great variety!)
- **waifu-pics** - Simple anime-style images
- **nekos** - Diverse categories (waifu, neko, kitsune, etc.)

**What you'll see:**
```
🎴 Fetch Character Images from APIs
============================================================

📋 Anime list: 18 anime
📡 Source: ANILIST

📥 Fetching character images from ANILIST...

============================================================
[1/18] Processing: Re:Zero − Starting Life in Another World
  🔍 Searching for anime: Re:Zero − Starting Life in Another World
  ✅ Found: Re:Zero -Starting Life in Another World- (ID: 21355)
  ✅ Found 2 characters (filtered from 50)
...
```

### Step 3: Download All Images

Once the fetch is complete, download all images:

```bash
npm run download:images character-images.json
```

This will:
- Download each image
- Organize them by anime/character folders
- Name them with rarity (e.g., `Rem-5-1.jpg`)
- Skip duplicates automatically
- Optimize images (if you have `sharp` installed)

**What you'll see:**
```
📥 Downloading Images...
============================================================

[1/20] Processing: Re:Zero − Starting Life in Another World > Rem
  📥 Downloading: https://...
  ✅ Saved: Re-Zero-Starting-Life-in-Another-World/Rem/Rem-5-1.jpg
...
```

### Step 4: Generate Manifest

After downloading, generate the manifest:

```bash
npm run generate:manifest
```

This creates `gacha-manifest-new.json` with all your characters properly structured.

### Step 5: Validate & Replace

Check everything is correct:

```bash
npm run validate:manifest
```

If everything looks good, replace the old manifest:

```bash
# Windows
copy gacha-manifest-new.json gacha-manifest.json

# Mac/Linux
cp gacha-manifest-new.json gacha-manifest.json
```

---

## 🎯 Method 2: Interactive Browse Method (For Each Anime)

**Use this if you want to see all characters and pick specific ones interactively!**

### Step 1: Browse Characters for Each Anime

For each anime, run:

```bash
npm run browse:characters "Re:Zero − Starting Life in Another World"
```

This will:
1. Search for the anime
2. Show all characters with gender info
3. Let you select which characters to download

**Example interaction:**
```
📋 Found 50 characters for "Re:Zero − Starting Life in Another World"

👩 Female characters (25):
  1. Rem (レム) - Female
  2. Emilia (エミリア) - Female
  3. Ram (ラム) - Female
  ...

Selection options:
  - Enter numbers separated by commas (e.g., "1,2,3")
  - Enter "all" to select all characters
  - Enter "female" to select all female characters
  - Enter "skip" to skip this anime

Select characters: female
```

### Step 2: Download Selected Images

After selecting, it will create a file like `selected-characters-1234567890.json`. Download those:

```bash
npm run download:images selected-characters-*.json
```

### Step 3: Repeat for Each Anime

Repeat for all 18 anime. This method is more interactive but takes longer.

---

## 🎨 Method 3: Filter for Female Characters Only

**If you want to ensure you only get female characters:**

```bash
npm run fetch:character-images my-characters-list.json --gender Female
```

This will filter out any male characters that might match the names.

---

## ⚡ Quick Command Summary

**All-in-one workflow:**
```bash
# 1. Fetch images (I've already created the JSON file for you!)
npm run fetch:character-images my-characters-list.json

# 2. Download images
npm run download:images character-images.json

# 3. Generate manifest
npm run generate:manifest

# 4. Validate
npm run validate:manifest

# 5. Replace manifest (if everything looks good)
copy gacha-manifest-new.json gacha-manifest.json
```

---

## 🔍 Troubleshooting

### Issue: Character name not found

**Solution:** The character name might be slightly different on AniList. Check the JSON file and try:
- Using the character's full name
- Using their Japanese name
- Using a partial name (the tool will match if it contains the text)

### Issue: Anime not found

**Solution:** The anime name might be different. Try:
- Using the Japanese title
- Using a shorter name
- Checking AniList for the exact title

### Issue: Not getting female characters

**Solution:** Use the gender filter:
```bash
npm run fetch:character-images my-characters-list.json --gender Female
```

### Issue: Getting wrong characters

**Solution:** Be more specific in the JSON:
```json
{
  "animeName": "Naruto",
  "characters": ["Hinata Hyuga", "Tsunade"],
  "animeId": 20  // Add AniList ID for better matching
}
```

---

## 📝 Editing the JSON File

If you need to edit `my-characters-list.json`, here's the format:

```json
[
  {
    "animeName": "Anime Name",
    "animeId": 12345,        // Optional: AniList ID (faster, more accurate)
    "malId": 67890,          // Optional: MyAnimeList ID
    "characters": ["Character 1", "Character 2"],  // Required: character names
    "rarity": 5              // Optional: default rarity (1-5)
  }
]
```

**Tips:**
- Add `animeId` for faster, more accurate matching
- Character names can be partial (e.g., "Rem" will match "Rem (Re:Zero)")
- All characters in your list are already set to rarity 5

---

## ✅ What You'll Get

After running all commands, you'll have:

1. **Downloaded Images:**
   - `images/gacha/Re-Zero-Starting-Life-in-Another-World/Rem/Rem-5-1.jpg`
   - `images/gacha/Re-Zero-Starting-Life-in-Another-World/Emilia/Emilia-5-1.jpg`
   - ... (and 18 more characters)

2. **Updated Manifest:**
   - `gacha-manifest.json` with all 20 characters
   - Properly organized by anime and character
   - All set to rarity 5

3. **Ready to Use:**
   - All images organized and named correctly
   - Manifest validated and ready
   - Characters available in your gacha system!

---

## 🎉 Next Steps

Once you have all the images:

1. **Test the gacha system** - Try rolling to see your new characters!
2. **Adjust rarities** - Edit the manifest if you want different rarities
3. **Add more characters** - Use the same process to add more!

---

**Ready to start? Run this command:**

```bash
npm run fetch:character-images my-characters-list.json
```

Good luck! 🎴✨

