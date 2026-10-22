"""Assemble CSS in explicit cascade order; keep the public URL stable during migration."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "css/bundles.json"


def assemble():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    outputs = {}
    used = set()
    for bundle in manifest["bundles"]:
        chunks = []
        for source in bundle["sources"]:
            source_path = (ROOT / source).resolve()
            if not source_path.is_relative_to(ROOT / "css") or source_path.suffix != ".css":
                raise ValueError(f"Invalid CSS source: {source}")
            if source in used:
                raise ValueError(f"Repeated CSS source: {source}")
            used.add(source)
            chunks.append(source_path.read_text(encoding="utf-8"))
        target = (ROOT / bundle["output"]).resolve()
        if not target.is_relative_to(ROOT / "css/releases") or target.suffix != ".css":
            raise ValueError(f"Invalid compatibility output: {target}")
        outputs[target] = "".join(chunks)
    # Every file in the new architecture must have a deliberate position in the cascade.
    for directory in ["core", "components", "pages", "features", "mobile", "legacy"]:
        for source in (ROOT / "css" / directory).rglob("*.css"):
            if source.relative_to(ROOT).as_posix() not in used:
                raise ValueError(f"CSS source missing from manifest: {source}")
    return outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail on stale output; never modify files")
    args = parser.parse_args()
    for target, content in assemble().items():
        if args.check:
            if not target.exists() or target.read_text(encoding="utf-8") != content:
                raise SystemExit(f"Stale CSS bundle: {target.relative_to(ROOT)}. Run npm run build:css.")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8", newline="\n")
        digest = hashlib.sha256(content.encode()).hexdigest()
        print(f"{'Checked' if args.check else 'Built'} {target.relative_to(ROOT)} SHA256={digest}")


if __name__ == "__main__":
    main()
