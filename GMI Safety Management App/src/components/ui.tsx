import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react"

type IconName = "arrow-right" | "bell" | "book" | "briefcase" | "building" | "calendar" | "camera" | "chart" | "check" | "chevron-down" | "clipboard" | "eye" | "eye-off" | "file" | "grid" | "hard-hat" | "help" | "logout" | "lock" | "menu" | "more" | "phone" | "plus" | "search" | "settings" | "shield" | "tools" | "upload" | "user" | "users" | "x"

const iconPaths: Record<IconName, ReactNode> = {
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5z" />
      <path d="M4 6.5v13" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
    </>
  ),
  building: (
    <>
      <path d="M3 21h18M6 21V4h12v17M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  camera: (
    <>
      <path d="M14.5 5 13 3h-2L9.5 5H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  "eye-off": (
    <>
      <path d="m3 3 18 18M10.6 6.2Q11.3 6 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.1 2.8M6.1 6.1C3.5 7.9 2 12 2 12s3.5 6 10 6a10 10 0 0 0 3.8-.7M9.8 9.8a3 3 0 0 0 4.4 4.4" />
    </>
  ),
  file: (
    <>
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v5h5M9 13h6M9 17h6" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  "hard-hat": (
    <>
      <path d="M4 14a8 8 0 0 1 16 0M2 14h20v4H2zM9 4v6M15 4v6" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9a2.4 2.4 0 1 1 3.4 2.2c-1.1.5-1.1 1.1-1.1 2M12 17h.01" />
    </>
  ),
  logout: (
    <>
      <path d="M10 5H4v14h6M14 8l4 4-4 4M18 12H9" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  phone: (
    <path d="M6.5 3h3l1.5 5-2 1.5a15 15 0 0 0 5.5 5.5l1.5-2 5 1.5v3a3 3 0 0 1-3 3C10 20.5 3.5 14 3.5 6a3 3 0 0 1 3-3Z" />
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-3.8 8-10V5l-8-3-8 3v7c0 6.2 8 10 8 10Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </>
  ),
  tools: (
    <>
      <path d="m14 7 3-3 3 3-3 3M13 8l-9 9 3 3 9-9M4 4l5 5M15 15l5 5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M5 14v6h14v-6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" />
    </>
  ),
  x: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
}

export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName
  size?: number
  className?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  )
}

export function Button({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`ui-button ${className}`} {...props}>
      {children}
    </button>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  endAdornment?: ReactNode
}

export function Field({
  label,
  error,
  endAdornment,
  className = "",
  ...props
}: FieldProps) {
  const id = props.id || props.name
  return (
    <label className="ui-field" htmlFor={id}>
      <span className="ui-field__label">{label}</span>
      <span className={`ui-field__control ${error ? "is-error" : ""}`}>
        <input
          id={id}
          className={`ui-field__input ${className}`}
          aria-invalid={!!error}
          {...props}
        />
        {endAdornment}
      </span>
      {error && <span className="ui-field__error">{error}</span>}
    </label>
  )
}

export function IconButton({
  label,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`ui-icon-button ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Brand({
  compact = false,
  inverse = false,
}: {
  compact?: boolean
  inverse?: boolean
}) {
  return (
    <div className={`brand ${inverse ? "brand--inverse" : ""}`}>
      <span className="brand__mark" aria-hidden="true">
        <span>G</span>
      </span>
      {!compact && (
        <span className="brand__type">
          <strong>GARUDA MART</strong>
          <small>INDONESIA</small>
        </span>
      )}
    </div>
  )
}

export function StatusDot({ label }: { label: string }) {
  return (
    <span className="status-dot">
      <i />
      {label}
    </span>
  )
}

export type BadgeTone = "neutral" | "info" | "warning" | "verification" | "success" | "danger"

export function StatusBadge({
  children,
  tone = "neutral",
  outlined = false,
  dashed = false,
  icon,
}: {
  children: ReactNode
  tone?: BadgeTone
  outlined?: boolean
  dashed?: boolean
  icon?: IconName
}) {
  return (
    <span
      className={`status-badge status-badge--${tone} ${
        outlined ? "is-outlined" : ""
      } ${dashed ? "is-dashed" : ""}`}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  )
}

export function ExpiryChip({ days }: { days: number }) {
  if (days < 0) return <StatusBadge tone="danger">Kedaluwarsa</StatusBadge>
  if (days <= 30)
    return (
      <StatusBadge tone="warning" icon="calendar">
        Akan Kedaluwarsa · {days} hari
      </StatusBadge>
    )
  return <StatusBadge tone="success">Berlaku</StatusBadge>
}

export function EmptyState({
  title,
  description,
  icon = "clipboard",
  action,
}: {
  title: string
  description: string
  icon?: IconName
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function RestrictedData() {
  return (
    <div className="restricted-data">
      <Icon name="lock" size={21} />
      <div>
        <strong>Data terbatas</strong>
        <p>Hanya HSE dan HR yang dapat melihat detail ini.</p>
      </div>
    </div>
  )
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-label="Memuat data">
      {Array.from({ length: lines }).map((_, index) => (
        <span key={index} />
      ))}
    </div>
  )
}

export function Toast({ message }: { message: string }) {
  return (
    <div className="toast" role="status">
      <Icon name="check" size={17} />
      {message}
    </div>
  )
}
