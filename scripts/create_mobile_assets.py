import os
import zlib

# Minimal valid 1x1 PNG bytes in pure Python
def make_png(color_rgb=(13, 17, 23)):
    r, g, b = color_rgb
    width, height = 128, 128
    raw_data = bytearray()
    for _ in range(height):
        raw_data.append(0)  # filter byte
        for _ in range(width):
            raw_data.extend([r, g, b, 255])
    
    def chunk(tag, data):
        return (len(data).to_bytes(4, 'big') +
                tag + data +
                zlib.crc32(tag + data).to_bytes(4, 'big'))

    png = bytearray(b'\x89PNG\r\n\x1a\n')
    ihdr_data = (width.to_bytes(4, 'big') +
                 height.to_bytes(4, 'big') +
                 bytes([8, 6, 0, 0, 0]))
    png.extend(chunk(b'IHDR', ihdr_data))
    png.extend(chunk(b'IDAT', zlib.compress(raw_data)))
    png.extend(chunk(b'IEND', b''))
    return bytes(png)

assets_dir = "/home/sahil-garg/projects/fitscan/mobile/assets"
os.makedirs(assets_dir, exist_ok=True)

png_bytes = make_png((88, 166, 255)) # FitScan accent color

for fname in ["icon.png", "splash.png", "adaptive-icon.png", "favicon.png"]:
    fpath = os.path.join(assets_dir, fname)
    with open(fpath, "wb") as f:
        f.write(png_bytes)
    print(f"Created {fpath}")

print("✅ Assets created successfully!")
