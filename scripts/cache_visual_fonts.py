"""Refresh test-only CDN font fixtures; review hashes/diffs before accepting snapshots."""
import hashlib
import json
import re
from pathlib import Path
from urllib.request import Request, urlopen

DEST = Path(__file__).resolve().parents[1] / "tests/fixtures/fonts"
SOURCES = {
    "inter.css": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
    "icons.css": "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css",
    "inter-license.txt": "https://raw.githubusercontent.com/rsms/inter/v4.1/LICENSE.txt",
    "icons-license.txt": "https://raw.githubusercontent.com/twbs/icons/v1.11.3/LICENSE",
}


def main():
    from urllib.parse import urljoin
    DEST.mkdir(parents=True, exist_ok=True)
    manifest = {}

    def download(url, name):
        request = Request(url, headers={"User-Agent": "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36"})
        with urlopen(request, timeout=60) as response:
            data = response.read()
        (DEST / name).write_bytes(data)
        manifest[url] = {"file": name, "sha256": hashlib.sha256(data).hexdigest()}
        return data

    for name, url in SOURCES.items():
        data = download(url, name)
        if name.endswith(".css"):
            for reference in re.findall(r"url\(['\"]?([^)'\"]+)", data.decode()):
                target = urljoin(url, reference)
                if target in manifest:
                    continue
                suffix = ".woff2" if ".woff2" in target else ".woff" if ".woff" in target else ".ttf"
                download(target, hashlib.sha256(target.encode()).hexdigest()[:16] + suffix)
    (DEST / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Cached {len(manifest)} test font resources with source URLs and hashes.")


if __name__ == "__main__":
    main()
