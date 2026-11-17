# Home Office

A home for Hyperliquid data.

A slab on a wall. The light outside falls on the wall: by day, warm sun through
leaves across the home repo's grey wall; at night, moonlight through blinds. The slab is cream paper by day and a dark
board by night, with ink to match. Nothing is drawn to look like wood or brick;
the feeling of home comes from light, sound, paper and time of day.

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

**markets**: one perp market at a time, HYPE by default. Its live price, the change
today, a live chart (1H, 1D, 1W, 1M, 1Y) and the market's numbers. The star keeps a
market at the top of the sidebar's list, above the 25 busiest by 24h volume. The
search icon, or `/`, finds any market.

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
| switch / `S` | sunlight: a warm window, leaf shadows swaying, clouds passing | wind, leaves, birds |
| switch / `M` | moonlight: cool light through blinds, a curtain edge in a draft | low wind, crickets |
| sound / `A` | | on / off |

`T` turns the switch. On a first visit the house follows the visitor's clock
(sunlight 6am–7pm). The light and sound are generated in code
(`src/weather/`), so there are no media files.

## Data

Hyperliquid's public info API (`POST https://api.hyperliquid.xyz/info`, no key):
`metaAndAssetCtxs`, `candleSnapshot`, `clearinghouseState`,
`spotClearinghouseState`, `spotMetaAndAssetCtxs`, `portfolio`,
`frontendOpenOrders`; and `wss://api.hyperliquid.xyz/ws` for `allMids`.
