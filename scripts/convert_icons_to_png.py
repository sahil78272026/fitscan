#!/usr/bin/env python3
import os
import sys
from PIL import Image

def convert_to_png(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return False
    try:
        with Image.open(file_path) as img:
            print(f"Current format for {file_path}: {img.format}, size: {img.size}, mode: {img.mode}")
            # Ensure RGBA mode for PNG transparency support if needed
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGBA')
            img.save(file_path, format='PNG')
            print(f"Successfully converted and saved {file_path} as PNG")
        return True
    except Exception as e:
        print(f"Error converting {file_path}: {e}")
        return False

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    mobile_assets = os.path.join(base_dir, 'mobile', 'assets')
    
    files = ['icon.png', 'adaptive-icon.png']
    for filename in files:
        full_path = os.path.join(mobile_assets, filename)
        convert_to_png(full_path)

if __name__ == '__main__':
    main()
