import { DEFAULT_CENTER } from '../constants/endpoints'
import type { LatLng } from '../types/transit'

export type AddressSuggestion = LatLng & {
  id: string
  label: string
  city?: string
  postcode?: string
}

type GeocodingResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number]
    }
    properties?: {
      id?: string
      label?: string
      city?: string
      postcode?: string
      score?: number
    }
  }>
}

const GEOCODING_URL = 'https://data.geopf.fr/geocodage/search'
const LE_MANS_SEARCH_RADIUS_METERS = 30_000

export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const url = new URL(GEOCODING_URL)
  url.searchParams.set('q', query.trim())
  url.searchParams.set('limit', '6')
  url.searchParams.set('lat', String(DEFAULT_CENTER.lat))
  url.searchParams.set('lon', String(DEFAULT_CENTER.lng))

  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`Recherche d'adresse indisponible (${response.status})`)
  }

  const data = (await response.json()) as GeocodingResponse

  return (data.features ?? [])
    .map<AddressSuggestion | null>((feature, index) => {
      const coordinates = feature.geometry?.coordinates
      const label = feature.properties?.label
      const score = feature.properties?.score

      if (
        !coordinates ||
        !label ||
        typeof score !== 'number' ||
        score < 0.5 ||
        !Number.isFinite(coordinates[0]) ||
        !Number.isFinite(coordinates[1])
      ) {
        return null
      }

      return {
        id: feature.properties?.id ?? `${coordinates[0]}-${coordinates[1]}-${index}`,
        label,
        city: feature.properties?.city,
        postcode: feature.properties?.postcode,
        lat: coordinates[1],
        lng: coordinates[0],
      }
    })
    .filter((suggestion): suggestion is AddressSuggestion => suggestion !== null)
    .filter((suggestion) => distanceInMeters(DEFAULT_CENTER, suggestion) <= LE_MANS_SEARCH_RADIUS_METERS)
}

function distanceInMeters(first: LatLng, second: LatLng) {
  const earthRadius = 6_371_000
  const firstLat = toRadians(first.lat)
  const secondLat = toRadians(second.lat)
  const deltaLat = secondLat - firstLat
  const deltaLng = toRadians(second.lng - first.lng)
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLng / 2) ** 2

  return 2 * earthRadius * Math.asin(Math.sqrt(haversine))
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}
