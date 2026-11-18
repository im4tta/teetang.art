/**
 * GLSL for the plate. Colours are handled as plain sRGB values from start to
 * finish (colour management is off in PlateScene), so what the colour picker
 * shows is what the plate shows.
 */

export const STYLE_CODE = { drawing: 0, print: 1, map: 2, satellite: 3 } as const;

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
  uniform float uLineScale;
  uniform vec3 uLight;
  uniform sampler2D uDrape;
  uniform bool uHasDrape;
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
    } else {
      vec3 base = uHasDrape ? texture2D(uDrape, vUv).rgb : uPaper;
      float shade = uStyle == 2 ? 0.72 + 0.4 * light : 0.82 + 0.3 * light;
      color = base * shade;
      if (uStyle == 2) color = mix(color, uInk, contour(0.12));
    }
    gl_FragColor = vec4(color, 1.0);
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
  varying vec2 vPos;
  void main() {
    vPos = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** A hatched shadow: screen-aligned stripes inside the plate's offset outline. */
export const shadowFragment = /* glsl */ `
  uniform int uShape;
  uniform vec2 uOffset;
  uniform vec3 uInk;
  uniform float uStripe;
  varying vec2 vPos;

  float shapeDistance(vec2 p) {
    if (uShape == 1) return length(p) - 0.5;
    if (uShape == 2) {
      vec2 q = abs(p);
      float flat_ = q.y - 0.4330127;
      float slant = dot(q, vec2(0.8660254, 0.5)) - 0.4330127;
      return max(flat_, slant);
    }
    vec2 q = abs(p) - 0.5;
    return max(q.x, q.y);
  }

  void main() {
    float d = shapeDistance(vPos - uOffset);
    float inside = 1.0 - smoothstep(-0.004, 0.004, d);
    float stripe = step(mod(gl_FragCoord.y, uStripe), uStripe * 0.42);
    float alpha = inside * stripe * 0.75;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uInk, alpha);
  }
`;
