import type { Bounds, LatLng } from '../types/transit'

export const TILE_SIZE = 256
export const MIN_ZOOM = 11
export const MAX_ZOOM = 17

export type Point = {
  x: number
  y: number
}

export type MapSize = {
  width: number
  height: number
}

export type MapTile = {
  key: string
  x: number
  y: number
  left: number
  top: number
}

export type GeoBounds = {
  north: number
  south: number
  east: number
  west: number
}

export function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

export function projectLatLng(point: LatLng, zoom: number): Point {
  const sinLat = Math.sin((point.lat * Math.PI) / 180)
  const scale = TILE_SIZE * 2 ** zoom

  return {
    x: ((point.lng + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + sinLat) / Math.max(1 - sinLat, Number.EPSILON)) /
          (4 * Math.PI)) *
      scale,
  }
}

export function unprojectPoint(point: Point, zoom: number): LatLng {
  const scale = TILE_SIZE * 2 ** zoom
  const lng = (point.x / scale) * 360 - 180
  const mercatorY = Math.PI - (2 * Math.PI * point.y) / scale
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(mercatorY) - Math.exp(-mercatorY)))

  return { lat, lng }
}

export function getTopLeftWorld(center: LatLng, zoom: number, size: MapSize): Point {
  const centerWorld = projectLatLng(center, zoom)

  return {
    x: centerWorld.x - size.width / 2,
    y: centerWorld.y - size.height / 2,
  }
}

export function createProjector(center: LatLng, zoom: number, size: MapSize) {
  const topLeft = getTopLeftWorld(center, zoom, size)

  return (point: LatLng): Point => {
    const world = projectLatLng(point, zoom)

    return {
      x: world.x - topLeft.x,
      y: world.y - topLeft.y,
    }
  }
}

export function getVisibleTiles(center: LatLng, zoom: number, size: MapSize): MapTile[] {
  if (size.width <= 0 || size.height <= 0) {
    return []
  }

  const topLeft = getTopLeftWorld(center, zoom, size)
  const tileCount = 2 ** zoom
  const minX = Math.floor(topLeft.x / TILE_SIZE)
  const maxX = Math.floor((topLeft.x + size.width) / TILE_SIZE)
  const minY = Math.max(0, Math.floor(topLeft.y / TILE_SIZE))
  const maxY = Math.min(tileCount - 1, Math.floor((topLeft.y + size.height) / TILE_SIZE))
  const tiles: MapTile[] = []

  for (let x = minX; x <= maxX; x += 1) {
    const wrappedX = ((x % tileCount) + tileCount) % tileCount

    for (let y = minY; y <= maxY; y += 1) {
      tiles.push({
        key: `${zoom}-${wrappedX}-${y}-${x}`,
        x: wrappedX,
        y,
        left: x * TILE_SIZE - topLeft.x,
        top: y * TILE_SIZE - topLeft.y,
      })
    }
  }

  return tiles
}

export function getMapBounds(center: LatLng, zoom: number, size: MapSize, padding = 0): GeoBounds {
  const topLeft = getTopLeftWorld(center, zoom, size)
  const northWest = unprojectPoint({ x: topLeft.x - padding, y: topLeft.y - padding }, zoom)
  const southEast = unprojectPoint(
    {
      x: topLeft.x + size.width + padding,
      y: topLeft.y + size.height + padding,
    },
    zoom,
  )

  return {
    north: northWest.lat,
    south: southEast.lat,
    west: northWest.lng,
    east: southEast.lng,
  }
}

export function isPointInBounds(point: LatLng, bounds: GeoBounds) {
  return (
    point.lat <= bounds.north &&
    point.lat >= bounds.south &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  )
}

export function boundsIntersect(first: Bounds, second: Bounds) {
  return (
    first.west <= second.east &&
    first.east >= second.west &&
    first.south <= second.north &&
    first.north >= second.south
  )
}

export function isPointOnScreen(point: Point, size: MapSize, padding = 80) {
  return (
    point.x >= -padding &&
    point.x <= size.width + padding &&
    point.y >= -padding &&
    point.y <= size.height + padding
  )
}

export function fitViewToPoints(points: LatLng[], size: MapSize, padding = 96) {
  if (!points.length || size.width <= 0 || size.height <= 0) {
    return null
  }

  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const projected = points.map((point) => projectLatLng(point, zoom))
    const xs = projected.map((point) => point.x)
    const ys = projected.map((point) => point.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    if (maxX - minX <= size.width - padding * 2 && maxY - minY <= size.height - padding * 2) {
      return {
        center: unprojectPoint({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, zoom),
        zoom,
      }
    }
  }

  const projected = points.map((point) => projectLatLng(point, MIN_ZOOM))
  const xs = projected.map((point) => point.x)
  const ys = projected.map((point) => point.y)

  return {
    center: unprojectPoint(
      {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
      },
      MIN_ZOOM,
    ),
    zoom: MIN_ZOOM,
  }
}
