# Medical Library V1.2 — Universal Medical Reader

## Repository
- `index.html` — Library homepage
- `reader.html?id=<id>` — one reusable Reader for all HTML documents
- `data/html-documents.json` — HTML metadata
- `data/drive-documents.json` — Drive metadata
- `documents/` — HTML source documents
- `assets/css/reader.css` — Reader shell
- `assets/js/reader.js` — Reader logic

## Flow
Library card → `reader.html?id=...` → metadata lookup → same-origin iframe loads the original HTML → automatic TOC → reading progress → font size → dark mode → print.

The source HTML remains the content authority. The Reader shell does not rewrite the medical content.
