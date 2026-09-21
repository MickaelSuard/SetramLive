import { lazy, Suspense, useMemo, useState } from 'react'
import { FleetPanel } from './components/FleetPanel'
import { Header } from './components/Header'
import { SETRAM_DATASET_URL } from './constants/endpoints'
import { useRealtimeVehicles } from './hooks/useRealtimeVehicles'
import { useStaticNetwork } from './hooks/useStaticNetwork'

const TransitMap = lazy(() =>
  import('./components/TransitMap').then((module) => ({ default: module.TransitMap })),
)

function App() {
  const networkState = useStaticNetwork()
  const realtimeState = useRealtimeVehicles(networkState.data)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [showStops, setShowStops] = useState(true)
  const [showRoutes, setShowRoutes] = useState(true)
  const vehicles = useMemo(() => {
    if (!selectedRouteId) {
      return realtimeState.vehicles
    }

    return realtimeState.vehicles.filter((vehicle) => vehicle.routeId === selectedRouteId)
  }, [realtimeState.vehicles, selectedRouteId])
  const selectedVehicle = useMemo(
    () => realtimeState.vehicles.find((vehicle) => vehicle.id === selectedVehicleId),
    [realtimeState.vehicles, selectedVehicleId],
  )

  return (
    <div className="h-dvh min-h-dvh overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      <div className="flex h-dvh min-h-dvh flex-col overflow-hidden">
        <Header
          vehicleCount={realtimeState.vehicles.length}
          feedTimestamp={realtimeState.feedTimestamp}
          isRefreshing={realtimeState.isRefreshing}
          hasError={Boolean(realtimeState.error)}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[380px_minmax(0,1fr)]">
          <FleetPanel
            network={networkState.data}
            networkStatus={networkState.status}
            networkError={networkState.error}
            vehicles={vehicles}
            allVehicles={realtimeState.vehicles}
            selectedRouteId={selectedRouteId}
            selectedVehicleId={selectedVehicleId}
            selectedVehicle={selectedVehicle}
            showStops={showStops}
            showRoutes={showRoutes}
            feedTimestamp={realtimeState.feedTimestamp}
            realtimeError={realtimeState.error}
            isRefreshing={realtimeState.isRefreshing}
            onSelectRoute={(routeId) => {
              setSelectedRouteId(routeId)
              setSelectedVehicleId(null)
            }}
            onSelectVehicle={setSelectedVehicleId}
            onToggleStops={() => setShowStops((current) => !current)}
            onToggleRoutes={() => setShowRoutes((current) => !current)}
          />
          <Suspense
            fallback={
              <section className="order-1 flex min-h-0 flex-1 items-center justify-center bg-zinc-900 text-sm text-zinc-400 lg:order-2">
                Chargement de la carte
              </section>
            }
          >
            <TransitMap
              network={networkState.data}
              vehicles={vehicles}
              allVehicles={realtimeState.vehicles}
              selectedVehicleId={selectedVehicleId}
              selectedRouteId={selectedRouteId}
              showStops={showStops}
              showRoutes={showRoutes}
              loading={networkState.status === 'loading' || realtimeState.status === 'loading'}
              onSelectVehicle={setSelectedVehicleId}
              onClearVehicle={() => setSelectedVehicleId(null)}
            />
          </Suspense>
        </main>
        <footer className="hidden min-h-9 items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950 px-4 text-xs text-zinc-500 lg:flex">
          <span>Données SETRAM via le Point d'Accès National transport.data.gouv.fr</span>
          <a href={SETRAM_DATASET_URL} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200">
            Source GTFS / GTFS-RT
          </a>
        </footer>
      </div>
    </div>
  )
}

export default App
