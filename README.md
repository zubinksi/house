# house

A home for Hyperliquid data.

The page is a wall in a room. The weather happens outside, and you only see the
light it lets in: sun through leaves, moonlight through blinds, rain sliding down
the glass. Nothing is drawn to look like wood or brick. The feeling of home comes
from light, sound and time of day, not props.

## Run it

It's a static site with no build step and no dependencies. Open `index.html` in a
browser, or serve the folder:

```sh
npx serve .
```

## Weather

| Key | Mode | Light on the wall | Sound |
| --- | --- | --- | --- |
| `S` | sunlight | warm window patch, leaf shadows swaying, clouds passing (`multiply`) | wind, leaves, birds |
| `M` | moonlight | cool light through blinds, a curtain edge in a draft (`screen`) | low wind, crickets |
| `R` | rain | diffuse window light, drops clinging and sliding down the glass (`multiply`) | rain, rumble, drips |
| `A` | | | sound on / off |

On a first visit the house follows the visitor's clock: sunlight from 6am to 7pm,
moonlight after that. A chosen mode is remembered on that device.

The light and sound are generated in code (`js/light.js`, `js/sound.js`), so there
are no video or audio files to host. Each light is drawn on a low-resolution canvas,
blurred with CSS, and blended over the whole page. The colour tokens are registered
with `@property` so the page fades between modes.

## Rooms

- **markets** — Hyperliquid perpetuals from the public info API
  (`POST https://api.hyperliquid.xyz/info`, `{"type":"metaAndAssetCtxs"}`),
  refreshed every 15 seconds. If the API can't be reached, the room shows labelled
  sample rows.
- vaults, staking, ledger — not built yet.

## Files

```
index.html        the page
css/house.css     tokens for each mode, layout
js/light.js       the light on the wall (canvas scenes + engine)
js/sound.js       ambient sound (Web Audio)
js/market.js      the markets room
js/main.js        mode switching, keys, clock
```
