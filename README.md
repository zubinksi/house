# house

A home for Hyperliquid data.

A paper slab on a wall. The weather outside sets the light on the wall: sun
through leaves, moonlight through blinds, rain sliding down the glass. The slab
stays paper, the way a sheet on a desk does. Nothing is drawn to look like wood or
brick; the feeling of home comes from light, sound, paper and time of day.

The paper, ink, fonts, linen chart and bronze switch come from the `home` repo
(`zubinksi/home`).

## Run it

A static site with no build step and no dependencies. Open `index.html` in a
browser, or serve the folder:

```sh
npx serve .
```

## Rooms

**markets** — one perp market at a time, HYPE by default: price, change today,
a linen price chart (1D, 1W, 1M, 1Y; drag or hover to read any point), oracle
price, 24h volume, open interest and funding. The search icon, or `/`, switches
market. The chosen market and range are remembered on the device.

**address** — the portfolio behind any address: account value, PnL and volume for
the period, perps equity, spot value, withdrawable; an account value or PnL chart
(1D, 1W, 1M, All); and positions, spot balances and open orders. The last address
is remembered on the device.

Both read Hyperliquid's public info API (`POST https://api.hyperliquid.xyz/info`),
no key needed: `metaAndAssetCtxs`, `candleSnapshot`, `clearinghouseState`,
`spotClearinghouseState`, `spotMetaAndAssetCtxs`, `portfolio` and
`frontendOpenOrders`. If the API can't be reached, markets shows labelled sample
data.

## Weather

| Control | Mode | Light on the wall | Sound |
| --- | --- | --- | --- |
| switch, `S` | sunlight | warm window light, leaf shadows swaying, clouds passing | wind, leaves, birds |
| switch, `M` | moonlight | cool light through blinds, a curtain edge in a draft | low wind, crickets |
| rain, `R` | rain | soft window light, drops clinging and sliding down the glass | rain, drips |
| sound, `A` | | | on / off |

`T` turns the switch. On a first visit the house follows the visitor's clock
(sunlight 6am–7pm, moonlight after); a chosen mode is remembered.

The light and sound are generated in code, so there are no media files. Each light
is a low-resolution canvas, blurred with CSS and blended over the wall behind the
slab. Colours are registered with `@property` so the page fades between modes.

## Files

```
index.html        the wall, the slab, both rooms
css/house.css     tokens per mode, slab, chart, switch
fonts/            Geist Serif and Geist Mono (SIL OFL, see fonts/OFL.txt)
js/light.js       the light on the wall
js/sound.js       ambient sound (Web Audio)
js/hl.js          Hyperliquid API and number formats
js/chart.js       linen chart (ported from home's Chart.tsx)
js/markets.js     markets room
js/address.js     address room
js/main.js        weather, switch, pages, keys
```
