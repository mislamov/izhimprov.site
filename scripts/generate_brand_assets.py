"""Refresh an unlisted brand kit's direct-file catalog without public discovery entries.

Usage: python scripts/generate_brand_assets.py <kit-directory> <public-kit-url>
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image


MEDIA_TYPES = {
    ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
    ".pdf": "application/pdf", ".zip": "application/zip", ".ttf": "font/ttf",
    ".woff2": "font/woff2", ".txt": "text/plain", ".css": "text/css",
}
PURPOSES = {
    "logo-main": "Основной знак",
    "logo-horizontal": "Горизонтальная компоновка с названием",
    "logo-vertical": "Вертикальная компоновка с названием",
    "logo-halftone": "Альтернатива с полутонами, если градиент технически недоступен",
    "logo-solid": "Одноцветная альтернатива для штампов, тиснения, шелкографии",
    "avatar-gradient": "Градиентный аватар", "avatar-orange": "Оранжевый аватар",
    "avatar-black": "Чёрный аватар",
    "graphic-beam-gradient": "Фоновый градиентный луч",
    "graphic-circle-gradient": "Фоновый градиентный круг",
    "graphic-beam-solid": "Фоновый луч с заливкой",
    "graphic-circle-solid": "Фоновый круг с заливкой",
    "rubik-light": "Сноски, weight 300", "rubik-regular": "Основной текст, weight 400",
    "rubik-medium": "Заголовки, weight 500", "rubik-OFL": "Лицензия Rubik, SIL OFL 1.1",
    "example-4": "Охранное поле, страница 4 PDF",
    "example-14": "Посты и карусели, страница 14 PDF",
    "example-15": "Анонсы и афиши, страница 15 PDF",
    "example-17": "Ролл-ап, страница 17 PDF", "example-18": "Свитшот, страница 18 PDF",
    "example-21": "Сумка, страница 21 PDF", "example-23": "Сертификат, страница 23 PDF",
    "brandbook": "Исходный брендбук, 23 страницы",
    "brand-assets": "ZIP: логотипы, графика, аватары; без шрифтов и брендбука",
    "tokens": "CSS-переменные бренда и @font-face",
}


def build_catalog(directory: Path, base_url: str) -> dict:
    parsed = urlparse(base_url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError("Use an absolute HTTPS kit URL without query or fragment")
    base_url = base_url.rstrip("/") + "/"
    files = sorted((directory / "files").iterdir()) + [directory / "tokens.css"]
    assets = []
    for path in files:
        if not path.is_file():
            continue
        content = path.read_bytes()
        if path.suffix in {".svg", ".txt", ".css"}:
            content = content.replace(b"\r\n", b"\n")  # Git's published text blobs use LF.
        asset = {
            "id": path.stem, "purpose": PURPOSES[path.stem],
            "url": base_url + path.relative_to(directory).as_posix(),
            "media_type": MEDIA_TYPES[path.suffix], "bytes": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
        }
        if path.suffix in {".png", ".webp"}:
            with Image.open(path) as image:
                asset.update(width=image.width, height=image.height)
        assets.append(asset)
    return {
        "schema_version": 1,
        "name": "Школа Ижевского Импрова — файлы бренда",
        "guide_url": base_url + "index.md",
        "access": "unlisted; direct GET; no authentication; do not add to public discovery",
        "checksum": "SHA-256 of the published file bytes; text uses LF line endings",
        "assets": assets,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("base_url")
    args = parser.parse_args()
    catalog = build_catalog(args.directory, args.base_url)
    target = args.directory / "assets.json"
    target.write_bytes((json.dumps(catalog, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print(f"Generated {target}: {len(catalog['assets'])} files")


if __name__ == "__main__":
    main()
