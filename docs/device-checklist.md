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
