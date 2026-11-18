# Home Office

A home for Hyperliquid data.

A slab on a wall. By day, warm sunlight falls through a blind across the home
repo's grey wall, and the slab is cream paper. At night, moonlight comes through blinds
onto a deep blue wall, and the slab turns a lighter blue with pale ink. Both are
the same scene (the blind's slats, a curtain edge in a draft, cloud shadows
passing) in two palettes. As in the home repo, type is pressed into the slab and rules are cut into
it, lit from the upper left. Nothing is drawn to look like wood or brick;
the feeling of home comes from light, sound, paper and time of day.

The slab is frosted vellum: the wall and its light show through it as soft
shapes, under a fine grain and a mottled frost (smoked by night), while type and
charts sit crisp on top.

The paper, ink, fonts, iris, linen and bronze switch come from the `home` repo
(`zubinksi/home`).

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

Vite + React + TypeScript, like `home`. There is no server: the browser reads
Hyperliquid's public API directly.

## Pages

The sidebar holds the two pages side by side, with the list for the open page
beneath them.

On a phone only the page shows. The menu icon above its name lays the sidebar
over it full width; choosing a market or address slides the page back.

**markets**: one perp market at a time, HYPE by default: crypto on Hyperliquid's
own dex, or stocks, indices, commodities and currencies listed through HIP-3 by
trade.xyz (the `xyz` dex; their names read `xyz:TSLA` in the API). The page
follows the midnight repo's chart page: a live dot, the ticker and its name, the
price large, the day's move beneath it, ranges (1H to 1Y) in a tray, the live
chart and the market's numbers. The search icon, or `/`, finds any market.

The sidebar's market list borrows midnight's filtering: chips for all, starred
and each category, and a sort that cycles volume, biggest gain and biggest fall.
Starred markets stay on top in the order they were starred; the star on each row
stars it there and then.

Categories are automatic. Hyperliquid's API carries each HIP-3 deployer's own
annotations (`perpConciseAnnotations`): a category (stocks, indices, preipo,
commodities, fx…), a display name (xyz:CL shows as WTIOIL) and search keywords
("anthropic" finds ANT). The chips are built from the categories there are, so a
market that lists or a new category appears without a code change. Markets on
Hyperliquid's own dex are crypto. Only the plain names shown beside a ticker
("Apple Inc.") are kept by hand, in `src/catalog.ts`.

**address**: the portfolio behind any address. The header reads "portfolio" or
"vault · name", with the short address as the title, its star and a copy link;
the search icon looks up another address or jumps to a starred one. Account value, PnL and volume for
the period, an account value or PnL chart (1D, 1W, 1M, All), and positions, spot
balances and open orders. The star keeps an address in the sidebar.

Stars, the open market, range and address are remembered on the device.

## Charts: liveline in linen

Charts use [liveline](https://github.com/benjitaylor/liveline) (MIT), a
canvas-drawn real-time line for React. Prices stream in over Hyperliquid's
WebSocket (`allMids`) and extend the line as they arrive.

`src/LinenLine.tsx` dresses it in the house style. Liveline has no hook for its
area fill, so the adapter wraps the chart canvas's 2D context:
- It swaps the one vertical gradient Liveline makes for the fill under the curve
  for the home repo's linen weave, clipped to the same curve.
- It sets Liveline's fonts to Geist Mono.
- It leaves Liveline's crosshair readout off the canvas (in line mode that is
  the only 13px text it draws). The home repo's readout replaces it, centred above
  the plot: the moment, then the value in ink.
- CSS gives the badge paper-coloured text on its ink pill.

This depends on how Liveline 0.0.7 draws, so the package is pinned to that exact
version. Check the linen after any upgrade. If the adapter stops matching, the
chart still works with Liveline's own gradient.

## Light and sound

| Control | Light on the wall | Sound |
| --- | --- | --- |
| switch / `S` | sunlight: warm daylight through a blind, a curtain edge, clouds passing | wind, leaves, birds |
| switch / `M` | moonlight: the same blind in cool, faint moonlight | low wind, crickets |
| sound / `A` | | on / off |

`T` turns the switch. On a first visit the house follows the visitor's clock
(sunlight 6am–7pm). The light and sound are generated in code
(`src/weather/`), so there are no media files.

## Data

Hyperliquid's public info API (`POST https://api.hyperliquid.xyz/info`, no key):
`metaAndAssetCtxs`, `candleSnapshot`, `clearinghouseState`,
`spotClearinghouseState`, `spotMetaAndAssetCtxs`, `portfolio`,
`frontendOpenOrders`, each with `dex: "xyz"` as well for trade.xyz's markets;
and `wss://api.hyperliquid.xyz/ws` for `allMids` on both dexes.
