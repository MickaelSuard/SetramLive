import {
  ArrowRight,
  Clock3,
  Footprints,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { searchAddresses } from '../services/geocoding'
import type { AddressSuggestion } from '../services/geocoding'
import type { StaticNetwork } from '../types/transit'
import { isLocationServed, planJourney } from '../utils/journey'
import type { JourneyLocation, JourneyPlan } from '../utils/journey'
import { RouteBadge } from './RouteBadge'

type JourneyPlannerProps = {
  network?: StaticNetwork
  plan: JourneyPlan | null
  position: JourneyLocation | null
  onPlanChange: (plan: JourneyPlan | null) => void
  onPositionChange: (position: JourneyLocation) => void
}

export function JourneyPlanner({
  network,
  plan,
  position,
  onPlanChange,
  onPositionChange,
}: JourneyPlannerProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [destination, setDestination] = useState<JourneyLocation | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [isPlanning, setIsPlanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (query.trim().length < 3 || query === destination?.label) {
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchAddresses(query, controller.signal)
        .then((results) => {
          setSuggestions(network ? results.filter((result) => isLocationServed(network, result)) : results)
          setIsSearching(false)
        })
        .catch((searchError: unknown) => {
          if (searchError instanceof DOMException && searchError.name === 'AbortError') {
            return
          }

          setSuggestions([])
          setIsSearching(false)
          setError(searchError instanceof Error ? searchError.message : "Recherche d'adresse impossible")
        })
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [destination?.label, network, query])

  const calculatePlan = useCallback(
    (nextOrigin: JourneyLocation, nextDestination: JourneyLocation) => {
      if (!network) {
        setError('Le réseau SETRAM est encore en cours de chargement.')
        return
      }

      if (!isLocationServed(network, nextOrigin)) {
        setError(
          nextOrigin.accuracy && nextOrigin.accuracy > 500
            ? `Votre position est trop imprécise (± ${formatAccuracy(nextOrigin.accuracy)}). Réessayez près d’une fenêtre ou en extérieur.`
            : 'Votre position est en dehors de la zone desservie par le réseau SETRAM.',
        )
        onPlanChange(null)
        return
      }

      if (!isLocationServed(network, nextDestination)) {
        setError('Cette adresse est trop éloignée du réseau SETRAM.')
        onPlanChange(null)
        return
      }

      setIsPlanning(true)
      setError(null)

      window.requestAnimationFrame(() => {
        const result = planJourney(network, nextOrigin, nextDestination)

        if (result) {
          onPlanChange(result)
          setIsOpen(false)
        } else {
          onPlanChange(null)
          setError("Aucun trajet SETRAM trouvé à proximité de ces deux points dans les prochaines heures.")
        }

        setIsPlanning(false)
      })
    },
    [network, onPlanChange],
  )

  const requestLocation = useCallback(
    (nextDestination = destination) => {
      if (!navigator.geolocation) {
        setError("La géolocalisation n'est pas disponible sur cet appareil.")
        return
      }

      setIsLocating(true)
      setError(null)
      navigator.geolocation.getCurrentPosition(
        (geolocationPosition) => {
          const nextOrigin: JourneyLocation = {
            label: 'Ma position',
            lat: geolocationPosition.coords.latitude,
            lng: geolocationPosition.coords.longitude,
            accuracy: geolocationPosition.coords.accuracy,
          }

          onPositionChange(nextOrigin)
          setIsLocating(false)

          if (nextDestination) {
            calculatePlan(nextOrigin, nextDestination)
          }
        },
        (locationError) => {
          setIsLocating(false)
          setError(getLocationError(locationError))
        },
        {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 0,
        },
      )
    },
    [calculatePlan, destination, onPositionChange],
  )

  const selectDestination = (suggestion: AddressSuggestion) => {
    const nextDestination: JourneyLocation = {
      label: suggestion.label,
      lat: suggestion.lat,
      lng: suggestion.lng,
    }

    setDestination(nextDestination)
    setQuery(suggestion.label)
    setSuggestions([])
    setError(null)

    if (position) {
      calculatePlan(position, nextDestination)
    } else {
      requestLocation(nextDestination)
    }
  }

  const updateQuery = (value: string) => {
    setQuery(value)
    setDestination(null)
    setError(null)
    setIsOpen(true)
    setSuggestions([])
    setIsSearching(value.trim().length >= 3)
  }

  return (
    <>
      <div
        className="absolute left-2 right-14 top-2 z-[1100] sm:left-4 sm:right-auto sm:top-4 sm:w-[27rem]"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-11 items-center rounded-md border border-zinc-300 bg-white text-zinc-900 shadow-xl">
          <Search className="ml-3 h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder="Adresse au Mans ou aux alentours"
            aria-label="Adresse de destination"
            className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-zinc-500"
          />
          {query ? (
            <button
              type="button"
              title="Effacer la destination"
              aria-label="Effacer la destination"
              onClick={() => {
                setQuery('')
                setDestination(null)
                setSuggestions([])
                onPlanChange(null)
              }}
              className="flex h-10 w-9 shrink-0 items-center justify-center text-zinc-500 hover:text-zinc-900"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            title="Utiliser ma position"
            aria-label="Utiliser ma position"
            onClick={() => {
              setIsOpen(true)
              requestLocation()
            }}
            className={`mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
              position ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700'
            }`}
          >
            {isLocating ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <LocateFixed className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {isOpen ? (
          <div className="mt-1.5 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
            <button
              type="button"
              onClick={() => requestLocation()}
              className="flex w-full items-center gap-3 border-b border-zinc-800 px-3 py-2.5 text-left hover:bg-zinc-900"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300">
                <Navigation className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{position ? 'Position obtenue' : 'Ma position'}</span>
                <span className="block truncate text-xs text-zinc-500">
                  {position
                    ? `Précision ± ${formatAccuracy(position.accuracy)}`
                    : 'Autoriser la géolocalisation'}
                </span>
              </span>
            </button>

            {isSearching ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-zinc-400">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Recherche en cours
              </div>
            ) : null}

            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => selectDestination(suggestion)}
                className="flex w-full items-start gap-3 border-b border-zinc-900 px-3 py-2.5 text-left last:border-b-0 hover:bg-zinc-900"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{suggestion.label}</span>
                  {suggestion.city ? (
                    <span className="block truncate text-xs text-zinc-500">
                      {suggestion.postcode} {suggestion.city}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}

            {error ? <div className="px-3 py-2.5 text-sm text-rose-300">{error}</div> : null}

            {!isSearching && !suggestions.length && !error && query.trim().length >= 3 ? (
              <div className="px-3 py-3 text-sm text-zinc-500">
                Aucune adresse desservie au Mans ou aux alentours.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isPlanning ? (
        <div className="absolute inset-0 z-[1150] flex items-center justify-center bg-zinc-950/25">
          <div className="flex items-center gap-2 rounded-md bg-zinc-950 px-4 py-3 text-sm text-zinc-100 shadow-2xl">
            <LoaderCircle className="h-4 w-4 animate-spin text-sky-300" aria-hidden="true" />
            Calcul de l’itinéraire
          </div>
        </div>
      ) : null}

      {plan ? <JourneyResultPanel plan={plan} onClose={() => onPlanChange(null)} /> : null}
    </>
  )
}

function JourneyResultPanel({ plan, onClose }: { plan: JourneyPlan; onClose: () => void }) {
  return (
    <div
      className="absolute bottom-2 left-2 right-2 z-[1100] max-h-[52dvh] overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl sm:bottom-4 sm:left-4 sm:right-auto sm:w-[27rem]"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start gap-3 border-b border-zinc-800 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-300">
          <Navigation className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{plan.destination.label}</h2>
              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                <span className="font-semibold text-zinc-100">{plan.totalMinutes} min</span>
                <span>Arrivée {formatClock(plan.arrivalAt)}</span>
              </div>
            </div>
            <button
              type="button"
              title="Fermer l’itinéraire"
              aria-label="Fermer l’itinéraire"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-900 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-h-[calc(52dvh-4.5rem)] overflow-y-auto overscroll-contain">
        <JourneyStep
          icon={Footprints}
          title={`Marcher ${formatDistance(plan.walkToBoardMeters)}`}
          detail={`jusqu’à ${plan.legs[0].from.name}`}
        />

        {plan.legs.map((leg, index) => (
          <div key={leg.tripId}>
            {index > 0 ? (
              <JourneyStep
                icon={ArrowRight}
                title={`Correspondance à ${leg.from.name}`}
                detail={`${minutesBetween(plan.legs[index - 1].arrivalAt, leg.departureAt)} min d’attente`}
              />
            ) : null}
            <div className="flex gap-3 border-b border-zinc-800 px-3 py-3">
              <RouteBadge route={leg.route} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {leg.route.type} {leg.route.shortName}
                  {leg.headsign ? ` vers ${leg.headsign}` : ''}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatClock(leg.departureAt)} · {leg.from.name}
                </div>
                <div className="mt-1 truncate text-xs text-zinc-500">
                  Arrivée {formatClock(leg.arrivalAt)} · {leg.to.name}
                </div>
              </div>
            </div>
          </div>
        ))}

        <JourneyStep
          icon={Footprints}
          title={`Marcher ${formatDistance(plan.walkFromAlightMeters)}`}
          detail="jusqu’à destination"
        />
      </div>
    </div>
  )
}

function JourneyStep({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Footprints
  title: string
  detail: string
}) {
  return (
    <div className="flex gap-3 border-b border-zinc-800 px-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center text-zinc-400">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-zinc-500">{detail}</div>
      </div>
    </div>
  )
}

function getLocationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return 'La localisation a été refusée. Autorisez-la dans les réglages du navigateur.'
  }

  if (error.code === error.TIMEOUT) {
    return "La position n'a pas pu être obtenue à temps."
  }

  return 'Votre position est momentanément indisponible.'
}

function formatDistance(meters: number) {
  if (meters < 1_000) {
    return `${Math.max(10, Math.round(meters / 10) * 10)} m`
  }

  return `${(meters / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`
}

function formatAccuracy(meters = 0) {
  if (meters < 1_000) {
    return `${Math.max(1, Math.round(meters))} m`
  }

  return `${(meters / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000))
}
