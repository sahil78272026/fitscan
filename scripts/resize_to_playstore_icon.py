#!/usr/bin/env python3
"""
Utility script to resize an image to Google Play Store icon specifications:
- 512 x 512 px
- 32-bit PNG (RGBA)
- Under 1024 KB (1 MB)
"""

import sys
import os
from PIL import Image

def resize_icon(input_path, output_path=None):
    if not os.path.exists(input_path):
        print(f"Error: File not found: {input_path}")
        return False

    if not output_path:
        base, _ = os.path.splitext(input_path)
        output_path = f"{base}_512x512.png"

    try:
        with Image.open(input_path) as img:
            img = img.convert("RGBA")
            # Resize with high-quality downsampling (Lanczos)
            resized = img.resize((512, 512), Image.Resampling.LANCZOS)
            resized.save(output_path, format="PNG", optimize=True)

        size_kb = os.path.getsize(output_path) / 1024
        print(f"✅ Successfully converted icon!")
        print(f"📍 Output path: {output_path}")
        print(f"📐 Dimensions: 512x512 px")
        print(f"📦 File size: {size_kb:.2f} KB (Google Play limit: < 1024 KB)")
        return True
    except Exception as e:
        print(f"Error processing image: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        in_file = sys.argv[1]
        out_file = sys.argv[2] if len(sys.argv) > 2 else None
        resize_icon(in_file, out_file)
    else:
        # Default to mobile/assets/icon.png
        default_in = os.path.join(os.path.dirname(__file__), "..", "mobile", "assets", "icon.png")
        default_out = os.path.join(os.path.dirname(__file__), "..", "mobile", "assets", "play-store-icon-512.png")
        resize_icon(default_in, default_out)
