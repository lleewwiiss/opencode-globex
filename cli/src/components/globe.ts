// ASCII Globe Renderer - Procedural rotating 3D sphere
// Based on ray-casting algorithm from DinoZ1729/Earth

// Character palette from dark to bright
const PALETTE = " .:;',wiogOLXHWYV@"

// Color gradient - green tones from dark to bright
const COLOR_GRADIENT = [
  "#1a1b26", // bg - for darkest shadow
  "#2a3a2a", // very dark green
  "#3a5a3a", // dark green
  "#4a7a4a", // mid-dark green
  "#5a9a5a", // mid green
  "#7ece6a", // green (close to colors.green)
  "#9ece6a", // bright green (colors.green)
  "#aede7a", // brighter green
  "#c0f090", // brightest green
]

// Default/max globe dimensions
const DEFAULT_WIDTH = 50
const DEFAULT_HEIGHT = 25

// Minimum usable globe size
export const MIN_GLOBE_HEIGHT = 10
export const MIN_GLOBE_WIDTH = 20

// Character aspect ratio (terminal chars are ~2x taller than wide)
const CHAR_ASPECT = 2

// Simple 3D vector operations
function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function normalize(v: number[]): number[] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  if (len === 0) return [0, 0, 0]
  return [v[0] / len, v[1] / len, v[2] / len]
}

function rotateY(p: number[], angle: number): number[] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    p[0] * cos + p[2] * sin,
    p[1],
    -p[0] * sin + p[2] * cos,
  ]
}

function rotateX(p: number[], angle: number): number[] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    p[0],
    p[1] * cos - p[2] * sin,
    p[1] * sin + p[2] * cos,
  ]
}

export interface GlobeCell {
  char: string
  color: string
}

export interface GlobeDimensions {
  width: number
  height: number
}

// Compute optimal globe dimensions for given terminal size
export function computeGlobeDimensions(
  terminalWidth: number,
  terminalHeight: number,
  reservedVertical: number = 8, // header + footer + title + margins
  reservedHorizontal: number = 4 // left/right padding
): GlobeDimensions | null {
  const availableHeight = terminalHeight - reservedVertical
  const availableWidth = terminalWidth - reservedHorizontal

  // Start with ideal height, capped by available space
  let height = Math.min(DEFAULT_HEIGHT, availableHeight)
  let width = Math.round(CHAR_ASPECT * height)

  // If width is too big, shrink to fit
  if (width > availableWidth) {
    width = availableWidth
    height = Math.floor(width / CHAR_ASPECT)
  }

  // Check minimum size
  if (height < MIN_GLOBE_HEIGHT || width < MIN_GLOBE_WIDTH) {
    return null // Too small to render meaningfully
  }

  return { width, height }
}

// Generate a single frame of the rotating globe with color info
export function renderGlobeFrame(
  angle: number,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT
): GlobeCell[][] {
  const lines: GlobeCell[][] = []
  const radius = 1.0
  const cameraZ = 3.0
  const light = normalize([1, 1, -1]) // Light direction
  const tilt = Math.PI * 23.5 / 180 // Earth-like axial tilt

  for (let yi = 0; yi < height; yi++) {
    const line: GlobeCell[] = []
    for (let xi = 0; xi < width; xi++) {
      // Convert screen coordinates to normalized coordinates [-1, 1]
      // Using center sampling for better symmetry
      const x = ((xi + 0.5 - width / 2) / height)
      const y = ((height / 2 - (yi + 0.5)) / (height / 2))

      // Ray direction (orthographic projection for cleaner look)
      const rayDir: number[] = [0, 0, -1]
      const rayOrigin = [x, y, cameraZ]

      // Ray-sphere intersection
      const oc = [rayOrigin[0], rayOrigin[1], rayOrigin[2]]
      const a = dot(rayDir, rayDir)
      const b = 2.0 * dot(oc, rayDir)
      const c = dot(oc, oc) - radius * radius
      const discriminant = b * b - 4 * a * c

      if (discriminant < 0) {
        // Ray misses sphere
        line.push({ char: " ", color: "#1a1b26" })
        continue
      }

      // Find intersection point
      const t = (-b - Math.sqrt(discriminant)) / (2 * a)
      const intersection = [
        rayOrigin[0] + t * rayDir[0],
        rayOrigin[1] + t * rayDir[1],
        rayOrigin[2] + t * rayDir[2],
      ]

      // Surface normal (for a sphere centered at origin, it's just the normalized intersection)
      let normal = normalize(intersection)

      // Apply rotation (globe spinning)
      normal = rotateY(normal, angle)
      // Apply tilt
      normal = rotateX(normal, tilt)

      // Calculate longitude and latitude for texture pattern
      const lon = Math.atan2(normal[0], normal[2])
      const lat = Math.asin(normal[1])

      // Lighting calculation (Lambertian)
      const intensity = Math.max(0, dot(normal, light))

      // Rim lighting (atmosphere glow at edges)
      const viewDir = [0, 0, 1] // camera looks toward -Z
      const rimFactor = 1 - Math.abs(dot(intersection, viewDir))
      const rim = Math.pow(rimFactor, 2.5) * 0.5 // edge glow

      // Create pattern: latitude lines (equator emphasis) and longitude lines
      const latLines = Math.abs(Math.sin(lat * 6)) < 0.15
      const lonLines = Math.abs(Math.sin(lon * 8)) < 0.1
      const equator = Math.abs(lat) < 0.08

      // Determine base brightness: diffuse + rim + ambient
      let brightness = intensity * 0.55 + rim + 0.08

      // Add grid lines
      if (equator) {
        brightness = Math.min(1, brightness + 0.35)
      } else if (latLines || lonLines) {
        brightness = Math.min(1, brightness + 0.15)
      }

      // Map brightness to palette character
      const paletteIndex = Math.floor(brightness * (PALETTE.length - 1))
      const char = PALETTE[Math.max(0, Math.min(paletteIndex, PALETTE.length - 1))]

      // Map brightness to color gradient
      const colorIndex = Math.floor(brightness * (COLOR_GRADIENT.length - 1))
      const color = COLOR_GRADIENT[Math.max(0, Math.min(colorIndex, COLOR_GRADIENT.length - 1))]

      line.push({ char, color })
    }
    lines.push(line)
  }

  return lines
}

// Pre-generate frames for smooth animation
export function generateGlobeFrames(
  frameCount: number = 30,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT
): GlobeCell[][][] {
  const frames: GlobeCell[][][] = []
  for (let i = 0; i < frameCount; i++) {
    const angle = (i / frameCount) * Math.PI * 2
    frames.push(renderGlobeFrame(angle, width, height))
  }
  return frames
}
