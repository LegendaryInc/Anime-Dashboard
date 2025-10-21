import os
import json
import re

# --- Configuration ---
GACHA_ROOT_DIR = 'images/gacha'
OUTPUT_FILE = 'gacha-manifest.json'
IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp', '.gif')

def get_rarity_from_filename(filename):
    """
    Extracts a number from a filename and assigns a rarity based on rules.
    e.g., 'Character-5.jpg' -> 3
    """
    # Use regex to find a number, typically after a hyphen and before the extension.
    match = re.search(r'(\d+)', filename)
    if not match:
        return 1 # Default to 1 Star if no number is found

    num = int(match.group(1))

    if num <= 2:
        return 1  # 1 Star
    elif num <= 4:
        return 2  # 2 Stars
    elif num <= 6:
        return 3  # 3 Stars
    elif num <= 8:
        return 4  # 4 Stars
    elif num <= 10:
        return 5  # 5 Stars
    else:
        return "Prismatic" # Special tier for 11+

def create_gacha_manifest():
    """
    Scans the GACHA_ROOT_DIR and generates a JSON manifest with paths and rarities.
    """
    print(f"🔍 Starting scan of '{GACHA_ROOT_DIR}' directory...")
    manifest_data = {}
    
    if not os.path.isdir(GACHA_ROOT_DIR):
        print(f"❌ Error: The directory '{GACHA_ROOT_DIR}' was not found.")
        return

    # Loop through AnimeName/CharacterName folders
    for anime_name in os.listdir(GACHA_ROOT_DIR):
        anime_path = os.path.join(GACHA_ROOT_DIR, anime_name)
        if os.path.isdir(anime_path):
            manifest_data[anime_name] = {}
            
            for character_name in os.listdir(anime_path):
                character_path = os.path.join(anime_path, character_name)
                if os.path.isdir(character_path):
                    variant_list = []
                    
                    # Loop through image files to build the variant list
                    for image_file in os.listdir(character_path):
                        if image_file.lower().endswith(IMAGE_EXTENSIONS):
                            rarity = get_rarity_from_filename(image_file)
                            relative_path = os.path.join(character_path, image_file).replace('\\', '/')
                            
                            variant_list.append({
                                "path": relative_path,
                                "rarity": rarity
                            })
                    
                    if variant_list:
                        manifest_data[anime_name][character_name] = variant_list

    # Write the collected data to the JSON file
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(manifest_data, f, indent=2, ensure_ascii=False)
        print(f"✅ Success! Manifest with rarity data created at '{OUTPUT_FILE}'.")
        print(f"   Found {len(manifest_data)} animes.")
    except Exception as e:
        print(f"❌ Error: Failed to write to '{OUTPUT_FILE}'. Reason: {e}")

if __name__ == "__main__":
    create_gacha_manifest()