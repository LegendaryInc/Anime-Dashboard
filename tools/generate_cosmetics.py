import os
import json
import re

# --- Configuration ---
COSMETICS_ROOT_DIR = 'cosmetics/packs'
OUTPUT_FILE = 'cosmetics-manifest.json'
# You can customize these costs and rarities
PACK_COSTS = {
    'sakura_pack': 750,
    'neon_pack': 600
}
RARITY_RULES = {
    'border': 'common',
    'icon': 'common',
    'animated': 'rare',
    'theme': 'epic'
}

def format_name(kebab_case_str):
    """Converts a kebab-case string like 'border-sakura-solid' to 'Border Sakura Solid'."""
    return ' '.join(word.capitalize() for word in kebab_case_str.split('-'))

def get_cosmetic_details(filename):
    """Extracts details like type and rarity from the filename."""
    base_name = os.path.splitext(filename)[0]
    
    item_type = base_name.split('-')[0] # 'border', 'theme', etc.
    
    # Determine rarity based on keywords in the filename
    rarity = RARITY_RULES.get(item_type, 'common') # Default to common
    if 'animated' in base_name:
        rarity = RARITY_RULES.get('animated', 'rare')
        
    return {
        "id": base_name,
        "name": format_name(base_name),
        "type": item_type,
        "rarity": rarity
    }

def create_cosmetics_manifest():
    """
    Scans the COSMETICS_ROOT_DIR and generates a JSON manifest for cosmetic packs.
    """
    print(f"🔍 Starting scan of '{COSMETICS_ROOT_DIR}' directory...")
    manifest_data = {"packs": {}}
    
    if not os.path.isdir(COSMETICS_ROOT_DIR):
        print(f"❌ Error: The directory '{COSMETICS_ROOT_DIR}' was not found.")
        return

    # Loop through each pack directory (e.g., 'sakura_pack')
    for pack_id in os.listdir(COSMETICS_ROOT_DIR):
        pack_path = os.path.join(COSMETICS_ROOT_DIR, pack_id)
        if os.path.isdir(pack_path):
            print(f"  - Found pack: {pack_id}")
            
            pack_items = []
            for item_file in os.listdir(pack_path):
                # We are just scanning for files to get their names, image content doesn't matter
                if os.path.isfile(os.path.join(pack_path, item_file)):
                    item_details = get_cosmetic_details(item_file)
                    pack_items.append(item_details)
            
            if pack_items:
                manifest_data["packs"][pack_id] = {
                    "name": format_name(pack_id.replace('_', '-')),
                    "cost": PACK_COSTS.get(pack_id, 1000), # Default cost if not specified
                    "items": pack_items
                }

    # Write the collected data to the JSON file
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(manifest_data, f, indent=2, ensure_ascii=False)
        print(f"✅ Success! Cosmetics manifest created at '{OUTPUT_FILE}'.")
        print(f"   Found {len(manifest_data['packs'])} packs.")
    except Exception as e:
        print(f"❌ Error: Failed to write to '{OUTPUT_FILE}'. Reason: {e}")

if __name__ == "__main__":
    create_cosmetics_manifest()
