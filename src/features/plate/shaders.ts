/**
 * GLSL for the plate. Colours are handled as plain sRGB values from start to
 * finish (colour management is off in PlateScene), so what the colour picker
 * shows is what the plate shows.
 */

export const STYLE_CODE = {
  drawing: 0,
  print: 1,
  elevation: 4,
  topo: 5,
  vintage: 6,
  map: 2,
  satellite: 3,
} as const;

export const surfaceVertex = /* glsl */ `
  attribute float elevation;
  attribute float ao;
  attribute float sun;
  uniform bool uBake;
  varying float vElevation;
  varying float vAo;
  varying float vSun;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vElevation = elevation;
    vAo = ao;
    vSun = sun;
    vNormal = normal;
    vUv = uv;
    // Baking draws the surface flat in texture space, north at v = 0.
    gl_Position = uBake
      ? vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0.0, 1.0)
      : projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const surfaceFragment = /* glsl */ `
  uniform int uStyle;
  uniform vec3 uInk;
  uniform vec3 uPaper;
  uniform float uInterval;
  uniform float uMin;
  uniform float uMax;
  uniform float uLineScale;
  uniform vec3 uLight;
  uniform sampler2D uDrape;
  uniform bool uHasDrape;
  uniform sampler2D uRamp;
  uniform float uAo;
  uniform bool uBake;
  uniform bool uWater;
  /** Snow from this share of the relief upwards; above 1 means no snow. */
  uniform float uSnow;
  /** Water up to this elevation in metres (a flood or a season's lake level). */
  uniform float uFlood;
  /** Lakes and rivers (red channel), laid over the plate's square. */
  uniform sampler2D uWaterMask;
  uniform bool uHasWaterMask;
  /** Routes and markers drawn on top, with alpha. */
  uniform sampler2D uOverlay;
  uniform bool uHasOverlay;
  /** 0 for the studio light; otherwise how warm the low sun is (0 noon, 1 horizon). */
  uniform float uWarmth;
  uniform bool uSunMode;
  varying float vElevation;
  varying float vAo;
  varying float vSun;
  varying vec3 vNormal;
  varying vec2 vUv;

  // 1 on a contour line, 0 between lines; index lines (every fifth) are heavier.
  float contour(float lines) {
    float f = vElevation / uInterval;
    float w = fwidth(f);
    float d = abs(fract(f + 0.5) - 0.5);
    bool isIndex = mod(floor(f + 0.5), 5.0) < 0.5;
    float half_ = (isIndex ? 1.25 : 0.6) * uLineScale;
    float line = 1.0 - smoothstep(w * half_, w * (half_ + 1.0), d);
    // Fade lines that would pile up into a grey smear on steep, distant slopes.
    return line * (1.0 - smoothstep(0.3, 0.75, w)) * lines;
  }

  void main() {
    vec3 n = normalize(vNormal);
    // A baked texture carries colour only; the renderer that uses it adds the light.
    float light = uBake ? 0.82 : clamp(dot(n, uLight), 0.0, 1.0);
    // Time of day: terrain casts shadows on itself.
    if (uSunMode && !uBake) light *= mix(0.22, 1.0, vSun);
    float h = clamp((vElevation - uMin) / (uMax - uMin), 0.0, 1.0);
    // Sea level (elevation data flattens the sea floor to 0 m), a flood, or a mapped lake or river.
    bool sea = uWater && vElevation < 0.5;
    bool flooded = vElevation < uFlood;
    bool lake = uHasWaterMask && texture2D(uWaterMask, vUv).r > 0.5;
    bool wet = sea || flooded || lake;
    float steep = clamp((1.0 - n.y) * 4.0, 0.0, 1.0);
    vec3 color;

    if (uStyle == 0) {
      float ink = contour(1.0) * mix(0.45, 1.0, steep);
      vec3 paper = mix(uPaper, uPaper * (0.8 + 0.2 * light), 0.6);
      color = mix(paper, uInk, ink);
    } else if (uStyle == 1) {
      float shade = smoothstep(0.05, 1.0, light);
      color = mix(uInk, uPaper, 0.25 + 0.75 * shade);
      color = mix(color, uInk, contour(0.18));
    } else if (uStyle == 4) {
      // Hypsometric tint from the chosen palette, lowest point on the left.
      vec3 tint = texture2D(uRamp, vec2(0.002 + h * 0.996, 0.5)).rgb;
      color = tint * (0.7 + 0.42 * light);
      color = mix(color, uInk, contour(0.2));
    } else if (uStyle == 6) {
      // Vintage survey map: aged paper, sepia ink, shading as if by hand.
      vec3 paper = vec3(0.91, 0.85, 0.72);
      vec3 sepia = vec3(0.36, 0.24, 0.14);
      float edge = smoothstep(0.32, 0.72, length(vUv - 0.5));
      paper *= 1.0 - edge * 0.16;
      color = mix(sepia, paper, 0.45 + 0.55 * smoothstep(0.0, 1.0, light));
      color = mix(color, sepia, contour(0.55) * mix(0.5, 1.0, steep));
    } else {
      vec3 base = uHasDrape ? texture2D(uDrape, vUv).rgb : uPaper;
      float shade = uStyle == 2 ? 0.72 + 0.4 * light : 0.82 + 0.3 * light;
      color = base * shade;
      if (uStyle == 2) color = mix(color, uInk, contour(0.12));
    }

    // Snow above the snow line, thinning out on steep rock.
    if (h > uSnow) {
      float cover = smoothstep(uSnow, uSnow + 0.04, h) * (1.0 - smoothstep(0.45, 0.85, steep));
      color = mix(color, vec3(0.97, 0.98, 1.0) * (0.84 + 0.18 * light), cover);
    }

    // Satellite and map imagery already show the sea; floods and lakes are painted on.
    bool imagery = uStyle == 2 || uStyle == 3 || uStyle == 5;
    if (wet && !(imagery && sea && !flooded && !lake)) {
      if (uStyle == 0 || uStyle == 1 || uStyle == 6) {
        // Old-map water: the paper tinted blue, with horizontal hatching.
        vec3 paper = uStyle == 6 ? vec3(0.91, 0.85, 0.72) : uPaper;
        vec3 ink = uStyle == 6 ? vec3(0.36, 0.24, 0.14) : uInk;
        vec3 water = uStyle == 6 ? vec3(0.68, 0.8, 0.83) : mix(paper, vec3(0.55, 0.72, 0.86), 0.32);
        float rows = vUv.y * 90.0;
        float hatch = abs(fract(rows) - 0.5);
        float width = fwidth(rows);
        float line = 1.0 - smoothstep(0.0, width * 1.5, hatch - 0.36);
        // Far away the lines would crowd into a grey smear: fade them out instead.
        line *= 1.0 - smoothstep(0.12, 0.3, width);
        color = mix(water, ink, line * 0.35);
      } else {
        vec3 water = vec3(0.42, 0.64, 0.8) * (0.86 + 0.14 * light);
        color = imagery ? mix(color, water, 0.72) : water;
      }
    }

    if (uHasOverlay) {
      vec4 overlay = texture2D(uOverlay, vUv);
      color = mix(color, overlay.rgb, overlay.a);
    }
    if (!uBake) color *= mix(1.0, smoothstep(0.35, 1.0, vAo), uAo);
    if (uSunMode && !uBake) {
      // Golden light near sunrise and sunset, cool blue in the shadows.
      vec3 warm = mix(vec3(1.0), vec3(1.12, 0.92, 0.72), uWarmth);
      vec3 cool = mix(vec3(1.0), vec3(0.78, 0.86, 1.05), uWarmth);
      color *= mix(cool, warm, vSun);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** The nameplate's top: box colour, with the letters in the surface colour. */
export const labelVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vNormal = normal;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const labelFragment = /* glsl */ `
  uniform sampler2D uMask;
  uniform vec3 uBase;
  uniform vec3 uText;
  uniform vec3 uLight;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    float light = clamp(dot(normalize(vNormal), uLight), 0.0, 1.0);
    float text = texture2D(uMask, vUv).a;
    vec3 color = mix(uBase, uText, smoothstep(0.25, 0.75, text));
    gl_FragColor = vec4(color * (0.78 + 0.32 * light), 1.0);
  }
`;

export const shellVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normal;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const shellFragment = /* glsl */ `
  uniform vec3 uSide;
  uniform vec3 uLight;
  uniform bool uStrata;
  varying vec3 vNormal;
  varying vec3 vPosition;

  float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }

  void main() {
    float light = clamp(dot(normalize(vNormal), normalize(vec3(uLight.x, 0.4, uLight.z))), 0.0, 1.0);
    vec3 color = uSide;
    if (uStrata) {
      // Rock layers: bands of uneven thickness that wander a little along the wall.
      float wander = sin((vPosition.x + vPosition.z) * 23.0) * 0.0025 + sin((vPosition.x - vPosition.z) * 61.0) * 0.001;
      float y = (vPosition.y + wander) * 70.0;
      float layer = floor(y);
      // Lightness shifts by a fixed amount, so layers show on dark and light boxes alike.
      float shade = hash(layer) - 0.5;
      float seam = 1.0 - smoothstep(0.0, 0.08, min(fract(y), 1.0 - fract(y)));
      color = clamp(color + vec3(shade * 0.22 - seam * 0.07), 0.0, 1.0);
    }
    gl_FragColor = vec4(color * (0.78 + 0.32 * light), 1.0);
  }
`;

export const shadowVertex = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** A hatched shadow: screen-aligned stripes over the plate's outline on the ground. */
export const shadowFragment = /* glsl */ `
  uniform vec3 uInk;
  uniform float uStripe;
  void main() {
    if (mod(gl_FragCoord.y, uStripe) > uStripe * 0.42) discard;
    gl_FragColor = vec4(uInk, 0.75);
  }
`;
