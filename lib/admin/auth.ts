// Accès à l'espace /admin : une simple liste d'emails autorisés (allowlist par
// variable d'environnement), pas de rôle dédié en base — même pattern que SIGGIE,
// répété indépendamment ici avec le projet Supabase propre à D-Scholar.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const allowed = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(email.toLowerCase())
}
