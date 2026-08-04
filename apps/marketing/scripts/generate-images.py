#!/usr/bin/env python3
"""
Generate Ghibli-style scene images for the Care Suite marketing site.

Requires: OPENAI_API_KEY environment variable
Usage:    python scripts/generate-images.py

This script generates 4 PNG images (800x500) for:
- nurse-care
- physio-exercise
- doctor-consultation
- medication-dispense

The generated images are saved to public/images/scenes/.
"""

import os
import sys
import urllib.request
import json

SCENES = {
    "nurse-care": (
        "A warm Ghibli-style illustration of a kind female nurse in white uniform "
        "checking on an elderly resident sitting on a nursing home bed. "
        "Soft morning light through a window, potted plants, pastel colors, "
        "peaceful and caring atmosphere, hand-drawn anime background style."
    ),
    "physio-exercise": (
        "A gentle Ghibli-style illustration of a physiotherapist helping an elderly "
        "person do light arm exercises in a bright rehabilitation room. "
        "Exercise ball, green plants, sunlight, warm pastel colors, "
        "hand-drawn anime background, hopeful and calm mood."
    ),
    "doctor-consultation": (
        "A calm Ghibli-style illustration of a doctor with a stethoscope talking "
        "to an elderly patient in a cozy nursing home clinic room. "
        "Desk with clipboard, soft lamp light, potted plant, pastel colors, "
        "hand-drawn anime background, trustworthy and warm atmosphere."
    ),
    "medication-dispense": (
        "A careful Ghibli-style illustration of a nurse handing medicine to an "
        "elderly resident at a nursing home medicine trolley. "
        "Medicine cabinet, pill bottles, warm indoor lighting, "
        "pastel colors, hand-drawn anime background, safe and attentive mood."
    ),
}

API_KEY = os.environ.get("OPENAI_API_KEY")
API_URL = "https://api.openai.com/v1/images/generations"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "images", "scenes")


def generate_image(prompt: str, out_path: str) -> None:
    if os.path.exists(out_path):
        print(f"Skipping {out_path} (already exists)")
        return

    data = json.dumps({
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024",
        "quality": "standard",
        "response_format": "url"
    }).encode("utf-8")

    req = urllib.request.Request(
        API_URL,
        data=data,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=120) as resp:
        body = json.loads(resp.read().decode("utf-8"))
        image_url = body["data"][0]["url"]

    urllib.request.urlretrieve(image_url, out_path)
    print(f"Saved {out_path}")


def main() -> int:
    if not API_KEY:
        print("Error: OPENAI_API_KEY environment variable is not set.", file=sys.stderr)
        print("Set it and rerun: python scripts/generate-images.py", file=sys.stderr)
        return 1

    os.makedirs(OUT_DIR, exist_ok=True)

    for name, prompt in SCENES.items():
        out_path = os.path.join(OUT_DIR, f"{name}.png")
        print(f"Generating {name}...")
        try:
            generate_image(prompt, out_path)
        except Exception as e:
            print(f"Failed to generate {name}: {e}", file=sys.stderr)
            return 1

    print("Done. Images saved to public/images/scenes/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
