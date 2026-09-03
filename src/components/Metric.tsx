type MetricProps = {
  label: string
  value: string | number
}

export function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-zinc-100">{value}</div>
    </div>
  )
}
