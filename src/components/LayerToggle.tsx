import type { LucideIcon } from 'lucide-react'

type LayerToggleProps = {
  icon: LucideIcon
  label: string
  enabled: boolean
  onToggle: () => void
}

export function LayerToggle({ icon: Icon, label, enabled, onToggle }: LayerToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
        enabled
          ? 'border-sky-400/50 bg-sky-500/15 text-sky-100'
          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}
