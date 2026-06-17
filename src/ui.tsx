import type { AppNotice } from './types'

export type IconName = 'home' | 'check' | 'calendar' | 'progress' | 'friends' | 'settings'

export function Icon({ name }: { name: IconName }) {
  const paths = {
    home: <path d="M3 11.5 12 4l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9.5Z" />,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    progress: <><path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" /></>,
    friends: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20a5 5 0 0 1 10 0" /><path d="M13.5 20a4 4 0 0 1 7.5 0" /></>,
    settings: <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="11" cy="17" r="2" /></>,
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export function AppNoticeToast({ notice, onDismiss }: { notice: AppNotice; onDismiss: () => void }) {
  return (
    <div className={`app-notice ${notice.tone}`} role="status" aria-live="polite">
      <span>{notice.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification">
        x
      </button>
    </div>
  )
}

export function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="form-section-title">
      <span>{number}</span>
      <h3>{title}</h3>
    </div>
  )
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  disabled = false,
  onChange,
}: {
  label: string
  value: number | null
  min: number
  max: number
  step?: number
  suffix: string
  disabled?: boolean
  onChange: (value: number | null) => void
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        />
        <small>{suffix}</small>
      </div>
    </label>
  )
}

export function TextField({
  label,
  value,
  type = 'text',
  disabled = false,
  onChange,
}: {
  label: string
  value: string
  type?: 'text' | 'date' | 'email' | 'password' | 'time'
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="text-field">
      <span>{label}</span>
      <input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

export function SelectField({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

export function CheckField({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="check-field">
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

export function RatingField({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="rating-field">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))}>
        {[1, 2, 3, 4, 5].map((number) => <option key={number} value={number}>{number}/5</option>)}
      </select>
    </label>
  )
}

export function TextArea({
  label,
  value,
  placeholder,
  disabled = false,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="text-area-field">
      <span>{label}</span>
      <textarea value={value} placeholder={placeholder} rows={4} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

export function NavButton({
  label,
  icon,
  active,
  badgeCount = 0,
  onClick,
}: {
  label: string
  icon: IconName
  active: boolean
  badgeCount?: number
  onClick: () => void
}) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      <Icon name={icon} />
      {badgeCount > 0 && <b className="nav-badge">{badgeCount}</b>}
      <span>{label}</span>
    </button>
  )
}
