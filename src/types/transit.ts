export type LatLng = {
  lat: number
  lng: number
}

export type Bounds = {
  north: number
  south: number
  east: number
  west: number
}

export type Stop = LatLng & {
  id: string
  name: string
  code?: string
  locationType: '0' | '1' | string
  parentStation?: string
  parentStationName?: string
}

export type Route = {
  id: string
  shortName: string
  longName: string
  color: string
  textColor: string
  type: 'Tram' | 'Bus' | 'Transport'
  sortOrder: number
}

export type Shape = {
  id: string
  routeId: string
  points: LatLng[]
  bounds: Bounds
}

export type StaticNetwork = {
  stops: Stop[]
  stationStops: Stop[]
  stopsById: Record<string, Stop>
  routes: Route[]
  routesById: Record<string, Route>
  shapes: Shape[]
  shapeIdsByRouteId: Record<string, string[]>
  tripRouteIds: Record<string, string>
  tripShapeIds: Record<string, string>
  loadedAt: number
}

export type Vehicle = LatLng & {
  id: string
  label: string
  routeId?: string
  tripId?: string
  directionId?: number
  stopId?: string
  stopName?: string
  bearing?: number
  speed?: number
  timestamp?: number
  status?: string
  route?: Route
}

export type RealtimeSnapshot = {
  vehicles: Vehicle[]
  feedTimestamp?: number
  fetchedAt: number
  version?: string
}

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
