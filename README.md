<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="/assets/logo.svg">
    <img src="/assets/logo.svg" width="80" alt="Tee Tang Art">
  </picture>
</p>

<h1 align="center">Tee Tang Art — ទីតាំង</h1>

<p align="center">
  Design beautiful, printable map posters of any place on Earth.
  <br>
  <strong><a href="https://teetang.art">teetang.art</a></strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite 7">
  <img src="https://img.shields.io/badge/MapLibre_GL-3-7CB342?logo=maplibre&logoColor=white" alt="MapLibre GL">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
</p>

---

## Features

- **Interactive Map Editor** — Pan, zoom, rotate, and style your map in real time using MapLibre GL with OpenStreetMap data
- **8 Poster Shapes** — Rectangle, rounded, circle, diamond, hexagon, star, triangle, heart
- **Color Themes** — Curated light, dark, and vintage palettes with per-layer customization
- **Dual-City Mode** — Split-layout posters with independent themes and locations for each half
- **Typography Controls** — Google Fonts picker, dynamic title/subtitle layout, letter spacing, alignment, footer text
- **Khmer Language Support** — Full UI translation with native Khmer font support
- **Marker Overlays** — Customizable pin markers with drag-and-drop positioning and custom icon uploads
- **Route Drawing** — Click two points or search location names A → B with OSRM road snapping
- **POI Highlights** — Toggle schools, hospitals, markets, banks, restaurants on the map
- **QR Code** — Configurable QR overlay linking to Google Maps, Apple Maps, WhatsApp, Telegram, or custom URL
- **Logo Overlay** — Upload custom logo with position, size, opacity, and padding controls
- **Export Formats** — PNG, PDF (via print), and layered SVG with high-resolution support
- **Desktop & Mobile** — Responsive accordion settings panel + swipe gestures on mobile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Bundler | Vite 7 |
| Map Engine | MapLibre GL JS |
| Tiles | OpenFreeMap, Carto (Voyager/Light/Dark), Esri Satellite |
| Routing | OSRM (public API) |
| Geocoding | Nominatim |
| Export | Canvas 2D + SVG (layered) |
| Fonts | Google Fonts (dynamic load) |
| i18n | English, Khmer |

## Quick Start

```bash
npm install
npm run dev      # Start dev server
npm run build    # Build for production
npm run typecheck
```

## Project Structure

```
src/
├── core/                  # Config, constants, global types, services
├── data/                  # Static data (themes.json, layouts.json)
├── features/
│   ├── export/            # PNG/PDF/SVG export engine
│   ├── install/           # PWA install prompt
│   ├── layout/            # Poster dimensions & aspect ratio
│   ├── location/          # Nominatim search + location parser
│   ├── map/               # Map preview, controls, POI overlay
│   ├── markers/           # Pin markers, custom icons, drag overlay
│   ├── poster/            # Poster state, reducer, preview panel, dual-city, text overlays
│   ├── routes/            # Route drawing, OSRM integration, endpoint markers
│   ├── theme/             # Color theme definitions & repository
│   └── updates/           # Changelog / update notifications
├── pages/                 # Home page, Create page
├── shared/
│   ├── geo/               # Math utilities (haversine, clamp, etc.)
│   ├── hooks/             # Swipe gestures, mobile viewport, etc.
│   ├── i18n/              # English + Khmer translation keys
│   ├── ui/                # App shell, modals, icons, user guides
│   └── utils/             # Storage, URL builders, search history
├── styles/                # CSS: desktop, mobile, forms, preview
└── types/                 # Global type declarations
```

## Roadmap

- [x] Interactive map with multiple tile providers
- [x] 8+ poster shapes with clip-path rendering
- [x] Custom markers with drag-and-drop
- [x] Route drawing with OSRM road snapping
- [x] Named route creation via location autocomplete (A → B)
- [x] Draggable route endpoints and via points
- [x] Dual-city split-layout posters with per-city themes
- [x] POI overlay (schools, hospitals, markets, banks, restaurants)
- [x] QR code with multi-destination support
- [x] Logo upload with position/size/opacity controls
- [x] Property card and shop signage layouts
- [x] Khmer language support
- [ ] Print-at-home templates with crop marks
- [ ] Custom GeoJSON / shape import
- [ ] Turn-by-turn navigation directions on poster

## Credits

- Inspired by [originalankur/maptoposter](https://github.com/originalankur/maptoposter)
- © [OpenStreetMap](https://openstreetmap.org/copyright) contributors
- Powered by MapLibre GL, OpenFreeMap, Nominatim, and OSRM

## License

MIT — see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <em>Built with love from Cambodia</em> ❤️
</p>
