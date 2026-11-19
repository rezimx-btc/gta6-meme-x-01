# Still Waiting for GTA 6 — make.fun entry

A funny GTA 6 meme drawn entirely in code: a Vice City neon sunset, a skeleton
still sitting in its beach chair after 13 years, and a calendar with every year
from 2013 to 2026 crossed out. The joke is simple — GTA 6 still isn't out, and
the fans are still waiting on the beach.

[![make.fun](https://make.fun/badge/gta6-meme-x-01.svg)](https://make.fun/bounty/gta6-meme-x-01)
[![rank](https://make.fun/badge/gta6-meme-x-01/rezimx-btc/gta6-meme-x-01/rank.svg)](https://make.fun/bounty/gta6-meme-x-01)
[![reward](https://make.fun/badge/gta6-meme-x-01/rezimx-btc/gta6-meme-x-01/reward.svg)](https://make.fun/bounty/gta6-meme-x-01)

## How to run

Requires Node.js 22 or newer. No dependencies, no network, no build step.

```sh
node main.ts
```

This writes `meme.png` (1200x675) and `post.txt` (the exact text for the X post)
into `./out`, or into the directory named by `MAKEFUN_OUTPUT_DIR` when set:

```sh
MAKEFUN_OUTPUT_DIR=./out node main.ts
```

## How it works

- `main.ts` draws the whole scene pixel by pixel into an RGB buffer: a
  gradient neon sky, a retro striped sun, a city skyline, palm-tree
  silhouettes, a beach, a skeleton in a beach chair, and a crossed-out
  calendar (2013–2026).
- All text uses a hand-designed 5x7 bitmap font typed into the source.
- The PNG is encoded by hand: raw scanlines, `node:zlib` deflate, and manual
  IHDR / IDAT / IEND chunks with correct CRC32.
- The output is fully deterministic — a fixed seed, no clock, no network —
  so every run produces byte-identical files.

## Files

- `main.ts` — the entrypoint (drawing + font + PNG encoder)
- `meme.png` — the generated meme image
- `post.txt` — the exact X post text
- `LICENSE` — MIT

## License

MIT — see `LICENSE`.
