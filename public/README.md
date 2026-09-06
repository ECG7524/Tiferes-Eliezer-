# Artwork

Drop the shul's crest in here as PNGs with **transparent backgrounds**, using
these exact filenames. Anything missing falls back to the next best file, and
finally to a typographic wordmark, so the site keeps working while you add them.

| Filename | What it should be | Where it appears |
|---|---|---|
| `logo-full.png` | The whole plate — crest, dedication, nasi line and address | Homepage hero, login and sign-up pages |
| `logo-mark.png` | The crest on its own, no text beneath | Site header, footer |
| `logo-mark-light.png` | The crest in the lighter, flatter gold | The shul display board, which is dark |

Also useful, though optional:

| Filename | What it should be |
|---|---|
| `icon.png` | A square crop of the crest, 512×512, for the browser tab and phone home screens |

## Notes

- **Transparent background, not white.** A white rectangle will show as a pale
  box against the ivory site and a bright slab on the dark board.
- **Wide, not square.** `logo-full.png` and `logo-mark.png` are used at a set
  height and scale to whatever width they need, so trim empty margins.
- Roughly 1400px wide is plenty; anything larger just makes pages slower.
