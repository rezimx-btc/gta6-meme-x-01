# WAITED — a GTA 6 meme for make.fun

A parody of GTA's iconic "WASTED" screen: after 13 years of waiting, it's not
WASTED — it's **WAITED**. A neon Vice City sunset, the make.fun ghost waving
front and center, and the punchline "13 YEARS FOR GTA 6 — 2013 → 2026".

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
  three-stop neon gradient sky, a low striped retro sun, a city skyline
  silhouette with lit windows, the giant outlined "WAITED" headline, the
  make.fun ghost mascot, and the "MAKE.FUN" wordmark.
- The PNG is encoded by hand with `node:zlib` (deflate) and manual PNG chunk
  writing (IHDR, IDAT, IEND) with correct CRC32 — no image libraries exist
  in the Node standard library.
- All text uses a hand-designed 5x7 bitmap font typed inline in `main.ts`.
- The program is fully deterministic: same bytes on every run (fixed seed,
  no wall-clock time, no unseeded randomness, no network).
