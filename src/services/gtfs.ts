import { strFromU8, unzipSync } from 'fflate'
import Papa from 'papaparse'
import { STATIC_GTFS_URL } from '../constants/endpoints'
import type { Bounds, LatLng, Route, Shape, StaticNetwork, Stop } from '../types/transit'

type CsvRow = Record<string, string | undefined>

type ShapePoint = LatLng & {
  sequence: number
}

const REQUIRED_FILES = new Set(['stops.txt', 'routes.txt', 'trips.txt', 'shapes.txt'])
const MAX_POINTS_PER_SHAPE = 120

export async function loadStaticNetwork(): Promise<StaticNetwork> {
  const response = await fetch(STATIC_GTFS_URL)

  if (!response.ok) {
    throw new Error(`GTFS statique indisponible (${response.status})`)
  }

  const archive = new Uint8Array(await response.arrayBuffer())
  const files = unzipSync(archive, {
    filter: (file) => REQUIRED_FILES.has(file.name),
  })

  for (const fileName of REQUIRED_FILES) {
    if (!files[fileName]) {
      throw new Error(`Fichier GTFS manquant: ${fileName}`)
    }
  }

  const stops = parseStops(strFromU8(files['stops.txt']))
  const routes = parseRoutes(strFromU8(files['routes.txt']))
  const { tripRouteIds, tripShapeIds, shapeRouteIds } = parseTrips(strFromU8(files['trips.txt']))
  const shapes = parseShapes(strFromU8(files['shapes.txt']), shapeRouteIds)
  const stopsById = Object.fromEntries(stops.map((stop) => [stop.id, stop]))
  const routesById = Object.fromEntries(routes.map((route) => [route.id, route]))
  const shapeIdsByRouteId = shapes.reduce<Record<string, string[]>>((acc, shape) => {
    if (!shape.routeId) {
      return acc
    }

    acc[shape.routeId] = acc[shape.routeId] ?? []
    acc[shape.routeId].push(shape.id)
    return acc
  }, {})

  for (const stop of stops) {
    if (stop.parentStation && stopsById[stop.parentStation]) {
      stop.parentStationName = stopsById[stop.parentStation].name
    }
  }

  return {
    stops,
    stationStops: stops.filter((stop) => stop.locationType === '1'),
    stopsById,
    routes,
    routesById,
    shapes,
    shapeIdsByRouteId,
    tripRouteIds,
    tripShapeIds,
    loadedAt: Date.now(),
  }
}

function parseCsv(csv: string): CsvRow[] {
  const result = Papa.parse<CsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
  })

  if (result.errors.length) {
    throw new Error(`CSV GTFS invalide: ${result.errors[0]?.message ?? 'erreur inconnue'}`)
  }

  return result.data
}

function parseStops(csv: string): Stop[] {
  return parseCsv(csv)
    .map((row) => ({
      id: row.stop_id?.trim() ?? '',
      code: row.stop_code?.trim() || undefined,
      name: row.stop_name?.trim() ?? 'Arrêt sans nom',
      lat: Number(row.stop_lat),
      lng: Number(row.stop_lon),
      locationType: row.location_type?.trim() || '0',
      parentStation: row.parent_station?.trim() || undefined,
    }))
    .filter((stop) => stop.id && Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
}

function parseRoutes(csv: string): Route[] {
  return parseCsv(csv)
    .map((row) => ({
      id: row.route_id?.trim() ?? '',
      shortName: row.route_short_name?.trim() || row.route_id?.trim() || 'Ligne',
      longName: row.route_long_name?.trim() || 'Destination non renseignée',
      color: normalizeColor(row.route_color, '#dc2626'),
      textColor: normalizeColor(row.route_text_color, '#ffffff'),
      type: getRouteType(row.route_type),
      sortOrder: Number(row.route_sort_order ?? Number.MAX_SAFE_INTEGER),
    }))
    .filter((route) => route.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.shortName.localeCompare(b.shortName, 'fr'))
}

function parseTrips(csv: string) {
  const tripRouteIds: Record<string, string> = {}
  const tripShapeIds: Record<string, string> = {}
  const shapeRouteIds = new Map<string, string>()

  for (const row of parseCsv(csv)) {
    const tripId = row.trip_id?.trim()
    const routeId = row.route_id?.trim()
    const shapeId = row.shape_id?.trim()

    if (!tripId) {
      continue
    }

    if (routeId) {
      tripRouteIds[tripId] = routeId
    }

    if (shapeId) {
      tripShapeIds[tripId] = shapeId
    }

    if (routeId && shapeId && !shapeRouteIds.has(shapeId)) {
      shapeRouteIds.set(shapeId, routeId)
    }
  }

  return { tripRouteIds, tripShapeIds, shapeRouteIds }
}

function parseShapes(csv: string, shapeRouteIds: Map<string, string>): Shape[] {
  const grouped = new Map<string, ShapePoint[]>()

  for (const row of parseCsv(csv)) {
    const shapeId = row.shape_id?.trim()
    const lat = Number(row.shape_pt_lat)
    const lng = Number(row.shape_pt_lon)
    const sequence = Number(row.shape_pt_sequence)

    if (!shapeId || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(sequence)) {
      continue
    }

    grouped.set(shapeId, grouped.get(shapeId) ?? [])
    grouped.get(shapeId)?.push({ lat, lng, sequence })
  }

  return Array.from(grouped.entries())
    .map(([id, points]) => {
      const sampledPoints = sampleShape(points)

      return {
        id,
        routeId: shapeRouteIds.get(id) ?? '',
        points: sampledPoints,
        bounds: getBounds(sampledPoints),
      }
    })
    .filter((shape) => shape.routeId && shape.points.length > 1)
}

function sampleShape(points: ShapePoint[]): LatLng[] {
  const sorted = points.sort((a, b) => a.sequence - b.sequence)
  const stride = Math.max(1, Math.ceil(sorted.length / MAX_POINTS_PER_SHAPE))
  const sampled = sorted
    .filter((_, index) => index % stride === 0)
    .map(({ lat, lng }) => ({ lat, lng }))
  const last = sorted.at(-1)

  if (last) {
    const sampledLast = sampled.at(-1)

    if (!sampledLast || sampledLast.lat !== last.lat || sampledLast.lng !== last.lng) {
      sampled.push({ lat: last.lat, lng: last.lng })
    }
  }

  return sampled
}

function normalizeColor(value: string | undefined, fallback: string) {
  const color = value?.trim().replace('#', '')

  if (color && /^[0-9a-fA-F]{6}$/.test(color)) {
    return `#${color}`
  }

  return fallback
}

function getBounds(points: LatLng[]): Bounds {
  return points.reduce<Bounds>(
    (bounds, point) => ({
      north: Math.max(bounds.north, point.lat),
      south: Math.min(bounds.south, point.lat),
      east: Math.max(bounds.east, point.lng),
      west: Math.min(bounds.west, point.lng),
    }),
    {
      north: -90,
      south: 90,
      east: -180,
      west: 180,
    },
  )
}

function getRouteType(routeType: string | undefined): Route['type'] {
  if (routeType === '0') {
    return 'Tram'
  }

  if (routeType === '3') {
    return 'Bus'
  }

  return 'Transport'
}
