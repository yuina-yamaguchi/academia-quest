"""PWAアイコン生成（開発用）: 枠+絵文字ベースのシンプルなアイコン"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ICONS = Path(__file__).resolve().parent / "icons"
NAVY = (46, 61, 99, 255)
GOLD = (201, 169, 106, 255)
CREAM = (245, 239, 225, 255)


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), CREAM if not maskable else NAVY)
    d = ImageDraw.Draw(img)

    pad = 0 if maskable else int(size * 0.06)
    border = max(3, int(size * 0.035))
    d.rounded_rectangle(
        [pad, pad, size - pad - 1, size - pad - 1],
        radius=int(size * 0.18),
        outline=GOLD,
        width=border,
        fill=NAVY if not maskable else None,
    )

    # 中央の装飾: 本 + 星
    cx, cy = size // 2, int(size * 0.44)
    book_w, book_h = int(size * 0.42), int(size * 0.3)
    d.rounded_rectangle(
        [cx - book_w // 2, cy - book_h // 2, cx + book_w // 2, cy + book_h // 2],
        radius=int(size * 0.04),
        fill=CREAM,
        outline=GOLD,
        width=max(2, int(size * 0.015)),
    )
    d.line([cx, cy - book_h // 2 + 4, cx, cy + book_h // 2 - 4], fill=GOLD, width=max(2, int(size * 0.012)))

    # 星
    star_r = int(size * 0.1)
    sy = int(size * 0.24)
    points = []
    import math

    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        r = star_r if i % 2 == 0 else star_r * 0.45
        points.append((cx + r * math.cos(ang), sy + r * math.sin(ang)))
    d.polygon(points, fill=GOLD)

    # 下の帯
    d.rounded_rectangle(
        [int(size * 0.2), int(size * 0.68), int(size * 0.8), int(size * 0.78)],
        radius=int(size * 0.04),
        fill=GOLD,
    )

    return img


def main() -> None:
    ICONS.mkdir(exist_ok=True)
    draw_icon(192).save(ICONS / "icon-192.png")
    draw_icon(512).save(ICONS / "icon-512.png")
    draw_icon(512, maskable=True).save(ICONS / "icon-maskable-512.png")
    print("icons generated")


if __name__ == "__main__":
    main()
