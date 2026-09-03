import type { LatLng } from '../types/transit'

export const VEHICLE_POSITIONS_URL =
  'https://proxy.transport.data.gouv.fr/resource/setram-lemans-gtfs-rt-vehicle-position'

export const STATIC_GTFS_URL =
  'https://www.data.gouv.fr/api/1/datasets/r/dee9adc5-044c-4f68-9cd3-eefbdf7a6abd'

export const SETRAM_DATASET_URL =
  'https://transport.data.gouv.fr/datasets/gtfs-du-reseau-des-transports-bus-et-tramway-setram-circulant-sur-le-territoire-le-mans-metropole'

export const DEFAULT_CENTER: LatLng = {
  lat: 48.0061,
  lng: 0.1996,
}

export const REALTIME_REFRESH_MS = 10_000
