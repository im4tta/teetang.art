# Real-device checklist for the 3D plate

The automated tests run in a browser with no GPU, no camera and no outside
network, so these need a real phone and the live site. Tick each on one iPhone
(Safari) and one Android phone (Chrome). Note the phone model when something fails.

## Basics

- [ ] `/plate` opens, the plate appears, it turns with a finger and pinch-zooms.
- [ ] A low-detail plate shows first, then sharpens ("Adding detail…").
- [ ] Every style loads: Drawing, Print, Elevation, Topo, Map, Satellite, Vintage.
- [ ] Topo and Satellite: try three base maps each (Adjust → Base map).
- [ ] Khmer: switch to KH; texts fit, nothing is cut off.

## Photo, video, AR

- [ ] Photo: the render sharpens within a minute; Save photo gives a PNG; Close works while it renders.
- [ ] Fly-over video (Download → Fly-over video): plays in the phone's gallery.
- [ ] View in AR (iPhone): Quick Look opens, the plate sits on a table at about 10 cm.
- [ ] View in AR (Android): a ring appears on the table, a tap places the plate, Close ends it.

## Water, routes and pins

- [ ] Explore → Tonlé Sap or Yeak Laom: turn on Lakes and rivers; the water shows.
- [ ] Route & pins: import a GPX from Strava or Google My Maps; the plate fits the track.
- [ ] Tap the plate to add a pin; draw a line; the profile chart shows.

## Terrain tools

- [ ] Adjust → Steepness map: the key shows the bands; slopes colour on the plate; the steepest angle is plausible.
- [ ] Route & pins → eye on a pin: hidden ground darkens, visible ground glows; the 50 m tower sees more than 2 m.
- [ ] Route & pins → drop on a pin: a blue path runs downhill and the catchment tints; a pin off a stream says so.
- [ ] Adjust → Elevation data: "Using:" names a dataset. Choose Copernicus GLO-30; "Using:" changes to Copernicus.
      If it falls back to the worldwide data, `/api/dem` is not reachable on this deployment.
- [ ] In the US, choose USGS 3DEP lidar; with an OpenTopography key, choose ALOS World 3D. (Neither server could be
      reached when these were built; both fall back safely.)

## Offline and sharing

- [ ] Explore → Save this plate for offline use. Turn on airplane mode, reopen the site
      from the home-screen icon, open the saved plate.
- [ ] Share a /plate link in Telegram and Messenger: the preview shows the place's name.
- [ ] Gift card: the QR code opens the same plate on another phone.

## Printing (with a slicer)

- [ ] STL from the plate page opens in the slicer with no repair warnings.
- [ ] STL Studio: hollow base, tiles ZIP and lithophane open without warnings.
- [ ] 3MF with Lakes and rivers on: the water is a separate part.

Report failures as issues on GitHub with the phone model and a screenshot.
