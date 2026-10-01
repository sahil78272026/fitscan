#!/usr/bin/env python3
import os
from PIL import Image

def resize_to_play_store_feature_graphic(source_path, target_path):
    target_width = 1024
    target_height = 500
    
    with Image.open(source_path) as img:
        print(f"Original image size: {img.size}")
        
        # Calculate aspect ratios
        src_w, src_h = img.size
        src_aspect = src_w / src_h
        target_aspect = target_width / target_height  # 2.048
        
        # Crop or fit to preserve center content
        if src_aspect > target_aspect:
            # Source is wider than target: fit to height, crop width
            new_w = int(src_h * target_aspect)
            left = (src_w - new_w) // 2
            box = (left, 0, left + new_w, src_h)
            cropped = img.crop(box)
        else:
            # Source is taller than target: fit to width, crop height
            new_h = int(src_w / target_aspect)
            top = (src_h - new_h) // 2
            box = (0, top, src_w, top + new_h)
            cropped = img.crop(box)
            
        final_img = cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)
        
        # Ensure RGB (Google Play requires no alpha for feature graphics)
        if final_img.mode != 'RGB':
            final_img = final_img.convert('RGB')
            
        final_img.save(target_path, format='PNG', optimize=True)
        print(f"Saved exact Play Store Feature Graphic ({target_width}x{target_height}) to {target_path}")

def main():
    source_img = "/home/sahil-garg/.gemini/antigravity-cli/brain/fdd17e42-d7ba-4470-a117-7d10db41bd3b/feature_graphic_1790759068259.jpg"
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_img = os.path.join(base_dir, "mobile", "assets", "feature-graphic.png")
    
    resize_to_play_store_feature_graphic(source_img, target_img)

if __name__ == "__main__":
    main()
