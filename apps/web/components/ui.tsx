import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-stone-200 bg-white shadow-sm shadow-stone-900/[0.02] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-500">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

const BADGE_TONES = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  neutral: "bg-stone-100 text-stone-600 ring-stone-500/15",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/20",
  danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
  info: "bg-violet-50 text-violet-700 ring-violet-600/20",
} as const;

export function Badge({
  tone = "neutral",
  children,
  dot = true,
}: {
  tone?: keyof typeof BADGE_TONES;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${BADGE_TONES[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const BUTTON_VARIANTS = {
  primary:
    "bg-teal-700 text-white hover:bg-teal-800 shadow-sm shadow-teal-900/10",
  secondary:
    "bg-white text-stone-700 ring-1 ring-inset ring-stone-300 hover:bg-stone-50",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-900/10",
  ghost: "text-stone-600 hover:bg-stone-100",
} as const;

const BUTTON_SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-4 py-16 text-center">
      {icon && <div className="text-stone-300">{icon}</div>}
      <p className="text-sm font-medium text-stone-600">{title}</p>
      {description && (
        <p className="max-w-xs text-xs leading-relaxed text-stone-400">
          {description}
        </p>
      )}
    </div>
  );
}

const ALERT_TONES = {
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-stone-200 bg-stone-50 text-stone-700",
} as const;

export function Alert({
  tone = "info",
  children,
}: {
  tone?: keyof typeof ALERT_TONES;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${ALERT_TONES[tone]}`}>
      {children}
    </div>
  );
}
