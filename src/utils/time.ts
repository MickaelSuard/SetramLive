export function formatClock(timestamp?: number) {
  if (!timestamp) {
    return 'Non reçu'
  }

  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp * 1000))
}

export function formatAge(timestamp?: number) {
  if (!timestamp) {
    return 'Jamais'
  }

  const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp * 1000) / 1000))

  if (diffSeconds < 60) {
    return `${diffSeconds}s`
  }

  const minutes = Math.round(diffSeconds / 60)

  if (minutes < 60) {
    return `${minutes} min`
  }

  return `${Math.round(minutes / 60)} h`
}

export function formatSpeed(speed?: number) {
  if (!Number.isFinite(speed)) {
    return 'n/a'
  }

  return `${Math.round(speed ?? 0)} km/h`
}
