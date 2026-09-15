interface RangeFilterProps {
  label: string
  minimum: number
  maximum: number
  low: number
  high: number
  step: number
  suffix: string
  onChange: (low: number, high: number) => void
}

export function RangeFilter({ label, minimum, maximum, low, high, step, suffix, onChange }: RangeFilterProps) {
  return <fieldset className="range-filter">
    <legend>{label}</legend>
    <div className="range-filter__values"><strong>{low} {suffix}</strong><span>–</span><strong>{high} {suffix}</strong></div>
    <div className="range-filter__sliders">
      <input aria-label={`${label} minimum`} type="range" min={minimum} max={maximum} step={step} value={low} onChange={(event) => onChange(Math.min(Number(event.target.value), high), high)} />
      <input aria-label={`${label} maximum`} type="range" min={minimum} max={maximum} step={step} value={high} onChange={(event) => onChange(low, Math.max(Number(event.target.value), low))} />
    </div>
  </fieldset>
}
