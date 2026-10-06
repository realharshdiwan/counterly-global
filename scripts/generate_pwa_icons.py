import os
import zlib
import struct
import math

def write_png(filename, width, height, pixels):
    """
    pixels: list of rows, where each row is a list of (r, g, b, a) tuples
    """
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    raw_data = bytearray()
    for row in pixels:
        raw_data.append(0)  # filter type 0: None
        for r, g, b, a in row:
            raw_data.extend([r, g, b, a])

    compressed = zlib.compress(bytes(raw_data), 9)

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    
    png = (
        b'\x89PNG\r\n\x1a\n' +
        chunk(b'IHDR', ihdr) +
        chunk(b'IDAT', compressed) +
        chunk(b'IEND', b'')
    )

    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(png)
    print(f"Generated {filename} ({width}x{height})")

def render_counterly_icon(width, height, is_maskable=False):
    # Brand Colors: Green bg #0E7440, light accent #22C55E, white #FFFFFF
    bg_r, bg_g, bg_b = 14, 116, 64
    acc_r, acc_g, acc_b = 34, 197, 94
    white_r, white_g, white_b = 255, 255, 255
    dark_r, dark_g, dark_b = 6, 78, 43

    cx, cy = width / 2.0, height / 2.0
    scale = (width / 512.0) * (0.75 if is_maskable else 0.88)
    
    # Corner radius for standard app icon
    r_corner = width * 0.22 if not is_maskable else 0

    pixels = []
    for y in range(height):
        row = []
        for x in range(width):
            # Check rounded corner if not maskable
            if not is_maskable:
                # Rounded rect distance
                dx = max(0, abs(x - cx) - (cx - r_corner))
                dy = max(0, abs(y - cy) - (cy - r_corner))
                dist = math.sqrt(dx*dx + dy*dy)
                if dist > r_corner:
                    row.append((0, 0, 0, 0))
                    continue

            # Normalized coordinate relative to center, scaled
            nx = (x - cx) / scale
            ny = (y - cy) / scale

            # Subtle gradient on background
            grad = (y / float(height)) * 0.2
            curr_bg_r = int(bg_r * (1.1 - grad))
            curr_bg_g = int(bg_g * (1.1 - grad))
            curr_bg_b = int(bg_b * (1.1 - grad))

            pixel = (curr_bg_r, curr_bg_g, curr_bg_b, 255)

            # Central Icon: Modern Geometric POS Terminal / Register + Shield
            # Top card / screen display (-110 <= ny <= -20, -110 <= nx <= 110)
            if -110 <= ny <= -20 and -100 <= nx <= 100:
                # Screen bezel
                border_dist = min(nx + 100, 100 - nx, ny + 110, -20 - ny)
                if border_dist < 12:
                    pixel = (white_r, white_g, white_b, 255)
                else:
                    # Inside screen
                    pixel = (dark_r, dark_g, dark_b, 255)
                    # "C" or rupee symbol inside screen
                    if -85 <= ny <= -45:
                        # Draw bar inside
                        if -70 <= nx <= 70 and abs(ny - (-65)) <= 6:
                            pixel = (acc_r, acc_g, acc_b, 255)
                        elif -40 <= nx <= 40 and abs(ny - (-48)) <= 4:
                            pixel = (white_r, white_g, white_b, 255)

            # Keypad Base (-10 <= ny <= 120, -130 <= nx <= 130)
            elif -10 <= ny <= 120:
                # Trapezoid slant: width increases toward bottom
                half_w = 100 + (ny - (-10)) * 0.25
                if abs(nx) <= half_w:
                    # Border
                    border_x = half_w - abs(nx)
                    border_y = min(ny - (-10), 120 - ny)
                    if min(border_x, border_y) < 10:
                        pixel = (white_r, white_g, white_b, 255)
                    else:
                        pixel = (dark_r, dark_g, dark_b, 255)
                        # Keypad dots (grid of 3x3 keys)
                        # ny in [15, 45, 75], nx in [-60, 0, 60]
                        for kx in [-60, 0, 60]:
                            for ky in [20, 52, 84]:
                                if abs(nx - kx) <= 18 and abs(ny - ky) <= 10:
                                    if ky == 84 and kx == 60:
                                        pixel = (acc_r, acc_g, acc_b, 255) # Green action key
                                    else:
                                        pixel = (white_r, white_g, white_b, 255)

            # Receipt feeding out of top (-145 <= ny <= -110, -60 <= nx <= 60)
            elif -150 <= ny <= -110 and abs(nx) <= 60:
                # Zig-zag or straight receipt paper
                pixel = (white_r, white_g, white_b, 255)
                # Text lines on receipt
                if -140 <= ny <= -136 and abs(nx) <= 40:
                    pixel = (curr_bg_r, curr_bg_g, curr_bg_b, 255)
                elif -128 <= ny <= -124 and abs(nx) <= 30:
                    pixel = (curr_bg_r, curr_bg_g, curr_bg_b, 255)

            row.append(pixel)
        pixels.append(row)
    return pixels

def main():
    os.makedirs('public', exist_ok=True)
    
    # 1. 192x192 PNG
    p192 = render_counterly_icon(192, 192, is_maskable=False)
    write_png('public/pwa-192x192.png', 192, 192, p192)

    # 2. 512x512 PNG
    p512 = render_counterly_icon(512, 512, is_maskable=False)
    write_png('public/pwa-512x512.png', 512, 512, p512)

    # 3. 512x512 Maskable PNG
    pmask = render_counterly_icon(512, 512, is_maskable=True)
    write_png('public/pwa-maskable-512x512.png', 512, 512, pmask)

    # 4. 180x180 Apple Touch Icon PNG
    papple = render_counterly_icon(180, 180, is_maskable=False)
    write_png('public/apple-touch-icon.png', 180, 180, papple)

    # 5. Favicon 64x64 PNG renamed or as icon
    pfav = render_counterly_icon(64, 64, is_maskable=False)
    write_png('public/favicon.ico', 64, 64, pfav)

    # 6. High quality Vector SVG
    svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#12894C" />
      <stop offset="100%" stop-color="#0A5F34" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.25" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  
  <!-- Receipt Paper -->
  <path d="M196 100 L316 100 L316 160 L196 160 Z" fill="#FFFFFF" filter="url(#shadow)" />
  <rect x="216" y="118" width="80" height="8" rx="4" fill="#0A5F34" opacity="0.6" />
  <rect x="226" y="134" width="60" height="6" rx="3" fill="#0A5F34" opacity="0.4" />
  
  <!-- POS Terminal Screen -->
  <rect x="156" y="150" width="200" height="110" rx="18" fill="#FFFFFF" filter="url(#shadow)" />
  <rect x="168" y="162" width="176" height="86" rx="10" fill="#064E2B" />
  <!-- Screen Elements -->
  <rect x="190" y="185" width="132" height="14" rx="4" fill="#22C55E" />
  <rect x="210" y="210" width="92" height="10" rx="3" fill="#FFFFFF" opacity="0.9" />
  
  <!-- Base & Keypad -->
  <path d="M136 270 L376 270 L396 390 L116 390 Z" fill="#FFFFFF" filter="url(#shadow)" />
  <path d="M148 280 L364 280 L382 380 L130 380 Z" fill="#064E2B" />
  
  <!-- Keypad Buttons -->
  <!-- Row 1 -->
  <rect x="160" y="295" width="46" height="20" rx="6" fill="#FFFFFF" />
  <rect x="233" y="295" width="46" height="20" rx="6" fill="#FFFFFF" />
  <rect x="306" y="295" width="46" height="20" rx="6" fill="#FFFFFF" />
  
  <!-- Row 2 -->
  <rect x="156" y="323" width="48" height="20" rx="6" fill="#FFFFFF" />
  <rect x="232" y="323" width="48" height="20" rx="6" fill="#FFFFFF" />
  <rect x="308" y="323" width="48" height="20" rx="6" fill="#FFFFFF" />
  
  <!-- Row 3 -->
  <rect x="152" y="351" width="50" height="20" rx="6" fill="#FFFFFF" />
  <rect x="231" y="351" width="50" height="20" rx="6" fill="#FFFFFF" />
  <rect x="310" y="351" width="50" height="20" rx="6" fill="#22C55E" />
</svg>'''
    with open('public/icon.svg', 'w') as f:
        f.write(svg_content)
    print("Generated public/icon.svg")

if __name__ == '__main__':
    main()
