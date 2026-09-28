// Classes partagées des formulaires et boutons, pour un rendu homogène sur
// tous les modules sans multiplier les composants.

export const inputClass =
  'mt-1.5 block w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:opacity-60'

export const labelClass = 'block text-sm font-medium text-foreground'

export const hintClass = 'mt-1 text-xs text-foreground-muted'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:opacity-50'

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-surface-border bg-surface px-3.5 py-2 text-sm font-semibold text-foreground shadow-xs transition hover:bg-background disabled:opacity-50'

export const btnIcon =
  'inline-flex items-center justify-center rounded-lg p-1.5 text-foreground-muted transition hover:bg-primary-soft hover:text-primary disabled:opacity-50'

export const cardClass = 'rounded-2xl border border-surface-border bg-surface shadow-xs'
