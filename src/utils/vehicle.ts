import type { Vehicle } from '../types/transit'

export function getVehicleEmoji(vehicle: Pick<Vehicle, 'route' | 'routeId'>) {
  const isTram = vehicle.route?.type === 'Tram' || (!vehicle.route && vehicle.routeId?.startsWith('T'))

  return isTram ? '\u{1F68B}' : '\u{1F68C}'
}

export function formatDirection(vehicle: Pick<Vehicle, 'directionId'>, compact = false) {
  if (typeof vehicle.directionId !== 'number') {
    return compact ? 'S?' : 'Sens inconnu'
  }

  const directionNumber = vehicle.directionId + 1

  return compact ? `S${directionNumber}` : `Sens ${directionNumber}`
}
