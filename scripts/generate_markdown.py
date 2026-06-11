from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parent.parent
EXCLUDED_DIRS = {".git", ".idea", ".claude", ".windsurf", "assets", "pub", "WORK", "SPEC"}


def iter_html_files() -> list[Path]:
    html_files: list[Path] = []
    for path in ROOT.rglob("*.html"):
        relative_parts = path.relative_to(ROOT).parts
        if any(part in EXCLUDED_DIRS for part in relative_parts):
            continue
        html_files.append(path)
    return sorted(html_files)


def pick_content_root(soup: BeautifulSoup):
    main = soup.find("main")
    if main is not None:
        return main

    legal_doc = soup.select_one(".legal-doc")
    if legal_doc is not None:
        return legal_doc

    body = soup.find("body")
    if body is not None:
        return body

    return soup


def cleanup_content(soup: BeautifulSoup, node) -> None:
    for tag in node.select("script, style, noscript, svg, picture, source"):
        tag.decompose()

    for tag in node.select("header, footer, nav"):
        tag.decompose()

    for tag in node.select(".nav-wrap, .menu, .footer-links, .btn-row, .logo-break, .spotlight"):
        tag.decompose()

    for img in node.find_all("img"):
        alt = (img.get("alt") or "").strip()
        if alt:
            img.replace_with(f"[Image: {alt}]")
        else:
            img.decompose()

    for details in node.find_all("details"):
        summary = details.find("summary")
        summary_text = summary.get_text(" ", strip=True) if summary else "Details"
        section = soup.new_tag("section")
        heading = soup.new_tag("h2")
        heading.string = summary_text
        section.append(heading)

        if summary is not None:
            summary.decompose()

        for child in list(details.contents):
            section.append(child.extract())

        details.replace_with(section)

    for tag in node.select(".btn-primary, .btn-secondary, .btn-text"):
        tag.name = "a"

    for link in node.find_all("a"):
        for attr in ("class", "target", "rel", "data-track"):
            link.attrs.pop(attr, None)

    for tag_name in ("div", "section", "article", "span"):
        for tag in list(node.find_all(tag_name)):
            tag.attrs = {}
            if tag.get_text(" ", strip=True):
                tag.unwrap()


def extract_metadata(soup: BeautifulSoup) -> list[str]:
    meta: list[str] = ["---"]

    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    if title:
        meta.append(f"title: {title}")

    description_tag = soup.find("meta", attrs={"name": "description"})
    description = (description_tag.get("content") or "").strip() if description_tag else ""
    if description:
        meta.append(f"description: {description}")

    canonical_tag = soup.find("link", attrs={"rel": "canonical"})
    canonical = (canonical_tag.get("href") or "").strip() if canonical_tag else ""
    if canonical:
        meta.append(f"canonical: {canonical}")

    meta.append("---")
    meta.append("")
    return meta


def convert_fragment_to_markdown(html_fragment: str) -> str:
    with tempfile.NamedTemporaryFile("w", suffix=".html", encoding="utf-8", delete=False) as handle:
        handle.write(html_fragment)
        temp_path = Path(handle.name)

    try:
        result = subprocess.run(
            [
                "pandoc",
                str(temp_path),
                "--from=html",
                "--to=gfm",
                "--wrap=none",
            ],
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        return result.stdout.strip()
    finally:
        temp_path.unlink(missing_ok=True)


def render_markdown(html_path: Path) -> str:
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")
    content_root = pick_content_root(soup)
    cleanup_content(soup, content_root)

    metadata = extract_metadata(soup)
    fragment = "".join(str(child) for child in content_root.contents)
    markdown_body = convert_fragment_to_markdown(fragment)
    markdown = "\n".join(metadata) + markdown_body + "\n"
    return markdown


def target_path_for(html_path: Path) -> Path:
    if html_path.name == "index.html":
        return html_path.with_name("index.md")
    return html_path.with_suffix(".md")


def main() -> int:
    generated = 0
    for html_path in iter_html_files():
        md_path = target_path_for(html_path)
        md_path.write_text(render_markdown(html_path), encoding="utf-8")
        generated += 1
        print(f"generated {md_path.relative_to(ROOT)}")

    print(f"generated {generated} markdown files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
