import { LocateFixed, Minus, Plus } from 'lucide-react'

type MapControlsProps = {
  onZoomIn: () => void
  onZoomOut: () => void
  onRecenter: () => void
}

export function MapControls({ onZoomIn, onZoomOut, onRecenter }: MapControlsProps) {
  return (
    <div className="absolute right-2 top-2 z-40 flex flex-col overflow-hidden rounded-md border border-zinc-300 bg-white shadow-xl sm:right-4 sm:top-4">
      <button
        type="button"
        title="Zoomer"
        aria-label="Zoomer"
        onClick={onZoomIn}
        className="flex h-9 w-9 items-center justify-center text-zinc-800 transition hover:bg-zinc-100 sm:h-10 sm:w-10"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        title="Dézoomer"
        aria-label="Dézoomer"
        onClick={onZoomOut}
        className="flex h-9 w-9 items-center justify-center border-t border-zinc-200 text-zinc-800 transition hover:bg-zinc-100 sm:h-10 sm:w-10"
      >
        <Minus className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        title="Recentrer"
        aria-label="Recentrer sur les véhicules"
        onClick={onRecenter}
        className="flex h-9 w-9 items-center justify-center border-t border-zinc-200 text-zinc-800 transition hover:bg-zinc-100 sm:h-10 sm:w-10"
      >
        <LocateFixed className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  )
}
