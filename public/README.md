# Artwork

`brand/` holds the shul's brand kit. The site loads these files directly, so
keep the names as they are — renaming one means editing `src/components/Crest.tsx`
and `src/lib/artwork.ts` to match.

## What the site actually loads

| File | Where it appears |
|---|---|
| `kte-logo-primary@2x.png` | Homepage, login and sign-up — the full plate with the dedication, nasi line and address |
| `kte-crest-mark.png` | Site header and footer — crest only, no text beneath |
| `kte-crest-mark@3x.png` | The shul display board, which needs the extra resolution on a television |
| `kte-icon-32/180/192/512.png` | Browser tab and phone home screens |

*Admin → Settings* lists these and whether each is present.

## The rest of the kit

Also here and unused by the site, kept so the office has them to hand for print,
email signatures and social:

- `kte-logo-primary.png` and `@3x` / `@4x` — the full plate at other sizes
- `kte-cartouche-mark.png`, `@4x` — the oval alone, without the lions
- `kte-logo-reverse-white.png` — for printing on a dark ground
- `kte-logo-black.png`, `kte-logo-grayscale.png`, `kte-logo-bronze-mono.png` — single-colour versions
- `kte-logo-email-240.png` — sized for an email signature
- `kte-crest-square-transparent-1024.png`, `kte-social-avatar-1024.png`, `-ivory.png` — square crops for profile pictures
- `kte-icon-16/64/1024.png` — the remaining icon sizes

## If a file goes missing

Each spot falls back to the next best file, and finally to a drawn cartouche
carrying the shul's name, so a page never shows a broken image.
