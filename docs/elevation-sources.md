# Elevation sources

Where the heights of a plate come from, which sources the app can use, and what
was and wasn't checked. Plate heights are always shown with the dataset that
actually supplied them (credit line under the plate, "Using:" line in
**Adjust → Elevation data**, and the contour SVG's `<desc>`).

## How a plate gets its heights

1. **Worldwide default: AWS Terrain Tiles** (Terrarium PNG tiles). Keyless, CORS-enabled, no server of ours.
   Each tile is cut from a patchwork of national and global models and says which
   in its `x-amz-meta-x-imagery-sources` header. The app reads that header and
   names the dataset ("SRTM (NASA)", "England lidar (Environment Agency)", …).
2. **Opt-in upgrades**, chosen per plate (`plate.elevation`, link parameter `dem`):

   | Choice (`dem=`)                       | Data                             | How it is read                                                        |
   | ------------------------------------- | -------------------------------- | --------------------------------------------------------------------- |
   | `copernicus`                          | Copernicus GLO-30, 30 m, global  | Cloud-optimised GeoTIFFs on AWS, read by byte range through `api/dem` |
   | `usgs3dep`                            | USGS 3DEP, down to 1 m, US only  | ArcGIS `exportImage` (GeoTIFF, float32)                               |
   | `ot:AW3D30`, `ot:COP30`, `ot:NASADEM` | ALOS (JAXA), Copernicus, NASADEM | OpenTopography global DEM API with the visitor's own free key         |

3. **Fallback.** If a chosen source is missing a key, doesn't cover the place, is
   too big for it, or fails for any reason, the plate is built from the worldwide
   tiles and the sheet says so. A failed upgrade never leaves a blank or flat plate.

Keys are kept in `localStorage` on the visitor's device. They are never put in
share links, saved drafts or analytics.

## Why a proxy for Copernicus

The public `copernicus-dem-30m` bucket serves the files but sends **no CORS
headers**, so browsers can't read it directly. `api/dem.ts` (Vercel edge
function) forwards a single, bounded byte range of a well-formed tile name from
the same origin. It refuses whole-file requests and anything that isn't a tile.
For a 10 km plate about 1 MB of a 45 MB tile is read. `vite.config.js` has the
same forwarding for `npm run dev`.

The nginx image has **no** `/api/dem`; there the Copernicus choice falls back to
the worldwide data (a 404 without the `x-dem: missing` header counts as a failure,
not as open sea).

## What the worldwide tiles already contain

Checked on real tiles (`x-amz-meta-x-imagery-sources`):

| Place                                                      | Zoom 14 source                           |
| ---------------------------------------------------------- | ---------------------------------------- |
| Cambodia (Phnom Aural, Tonlé Sap), Japan, Nepal, Australia | SRTM 30 m                                |
| London                                                     | UK lidar 2 m                             |
| Mount Rainier                                              | USGS NED lidar                           |
| Toronto                                                    | USGS 1/3″ (Canada's CDEM at lower zooms) |
| Amsterdam, Edinburgh, Rome                                 | EU-DEM 25 m                              |

So England, much of the US and Canada are already high-resolution by default;
the opt-in sources matter most in Southeast Asia, Japan, Australia and for
Italy, Scotland and the Netherlands, where the default is 25–30 m.

## The eleven datasets people ask about

| Dataset                      | Status                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRTM (NASA)                  | In the worldwide tiles (that is the 30 m in most of the tropics).                                                                                             |
| Copernicus GLO-30            | **Built**: `copernicus` through `api/dem`, and `ot:COP30`.                                                                                                    |
| GEM-15 (Google)              | Not built. It is only available through Earth Engine, which needs a signed-in Google account and server-side calls. Revisit if it is published as open files. |
| ETOPO (NOAA)                 | In the worldwide tiles for the sea floor; the plate flattens everything below sea level to 0.                                                                 |
| US 3DEP                      | **Built**: `usgs3dep`; the worldwide tiles also carry NED.                                                                                                    |
| Canada HRDEM                 | Not built. CDEM is in the worldwide tiles. HRDEM's WCS needs per-server testing from a network that can reach it.                                             |
| England (Environment Agency) | In the worldwide tiles (2 m lidar where available).                                                                                                           |
| Scotland                     | Not built. Public-sector lidar is published as 10 km download tiles in the British National Grid, with no range-readable service.                             |
| Italy (CNR 5 m)              | Not built. One very large file on Zenodo, not a tile service; it would need to be cut into a tile pyramid first.                                              |
| Netherlands AHN              | Not built. PDOK serves it in the Dutch national grid (EPSG:28992), so it needs a projection step and testing against the live server.                         |
| OpenTopography               | **Built** as the key-based source above (AW3D30, COP30, NASADEM).                                                                                             |

## What was verified, and what was not

Verified with real data: Copernicus tile `N12E104`/`N11E104` read by range
through a local stand-in for `api/dem`: Phnom Aural's summit came out at 1,803–1,808 m
after smoothing, depending on grid detail (the published height is about 1,813 m); against the worldwide
tiles for the same 10 km plate the correlation was 0.9998 with 8.5 m RMS, a
one-cell shift made it worse (so the georegistration is right), and the seam
between the two tiles had 100% coverage.

Verified with synthetic servers (Playwright, `tests/e2e/elevation.spec.ts`): the
Copernicus ranged reads, USGS and OpenTopography request shapes, keys staying
out of links and drafts, and every fallback path.

**Not verified against the live servers** (the build environment could reach
neither): the USGS 3DEP image server's exact parameters and CORS, and
OpenTopography's CORS and dataset names. Both fall back safely if wrong. Please
try one US plate with _USGS 3DEP lidar_ and one plate with an OpenTopography key
after deploying, and `api/dem` itself once on Vercel.
