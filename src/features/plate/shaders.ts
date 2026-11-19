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
  map: 2,
  satellite: 3,
} as const;

export const surfaceVertex = /* glsl */ `
  attribute float elevation;
  varying float vElevation;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vElevation = elevation;
    vNormal = normal;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
  varying float vElevation;
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
    float light = clamp(dot(n, uLight), 0.0, 1.0);
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
      float h = clamp((vElevation - uMin) / (uMax - uMin), 0.0, 1.0);
      vec3 tint = texture2D(uRamp, vec2(0.002 + h * 0.996, 0.5)).rgb;
      color = tint * (0.7 + 0.42 * light);
      color = mix(color, uInk, contour(0.2));
    } else {
      vec3 base = uHasDrape ? texture2D(uDrape, vUv).rgb : uPaper;
      float shade = uStyle == 2 ? 0.72 + 0.4 * light : 0.82 + 0.3 * light;
      color = base * shade;
      if (uStyle == 2) color = mix(color, uInk, contour(0.12));
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
  void main() {
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const shellFragment = /* glsl */ `
  uniform vec3 uSide;
  uniform vec3 uLight;
  varying vec3 vNormal;
  void main() {
    float light = clamp(dot(normalize(vNormal), normalize(vec3(uLight.x, 0.4, uLight.z))), 0.0, 1.0);
    gl_FragColor = vec4(uSide * (0.78 + 0.32 * light), 1.0);
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
