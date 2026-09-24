#!/usr/bin/env python3
"""Assemble the single self-contained index.html from tpl_head.html + three.js + app.js + images."""
import base64, pathlib, sys

ROOT = pathlib.Path(__file__).parent
three = (ROOT / "three.min.js").read_text(encoding="utf-8")
head = (ROOT / "tpl_head.html").read_text(encoding="utf-8")
app = (ROOT / "tpl_app.js").read_text(encoding="utf-8")

# safety: inline JS must not contain a literal closing script tag
for name, src in (("three", three), ("app", app)):
    low = src.lower()
    if "</script" in low:
        print(f"ERROR: {name} contains </script — aborting", file=sys.stderr)
        sys.exit(1)

out = head.replace("{{THREE_JS}}", "<script>\n" + three + "\n</script>").replace("{{APP_JS}}", app)

IMAGES = {
    "img_00": "inputs/img_00.jpg",
    "scene_02": "inputs/scene_02.jpg",
    "scene_06": "inputs/scene_06.jpg",
    "scene_04": "inputs/scene_04.jpg",
}
for name, rel in IMAGES.items():
    token = "{{IMG:%s}}" % name
    if token not in out:
        print(f"WARN: token {token} not found in template", file=sys.stderr)
    data = base64.b64encode((ROOT / rel).read_bytes()).decode("ascii")
    out = out.replace(token, "data:image/jpeg;base64," + data)

dest = ROOT / "index.html"
dest.write_text(out, encoding="utf-8")
print(f"wrote {dest} ({dest.stat().st_size/1024:.0f} KB)")
