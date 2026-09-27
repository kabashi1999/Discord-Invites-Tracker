# Fonts folder

Place these four font files here (exact filenames matter — `imageGenerator.js` loads them by path):

- `NotoSansArabic-Regular.ttf`
- `NotoSansArabic-Bold.ttf`
- `NotoSans-Regular.ttf`
- `NotoSans-Bold.ttf`

Download them for free from Google Fonts:

- https://fonts.google.com/noto/specimen/Noto+Sans+Arabic
- https://fonts.google.com/noto/specimen/Noto+Sans

Unzip each download and copy the `.ttf` files into this folder. Once they're here, `/invites` will render Arabic text correctly (proper shaping/ligatures) and the bot works fully offline — no runtime font downloads or external image APIs are used.

If a font file is missing, the bot still runs and generates the image, but logs a console warning and falls back to a system font, which may not render Arabic script correctly.
