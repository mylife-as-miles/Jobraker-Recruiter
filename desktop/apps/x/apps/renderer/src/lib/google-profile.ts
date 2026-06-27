export function googleDisplayName(
  profileName?: string | null,
  profileEmail?: string | null,
  fallback = 'Miles Okafor',
): string {
  const name = profileName?.trim()
  if (name && name.toLowerCase() !== 'google user') return name

  const email = profileEmail?.trim()
  if (email && email.toLowerCase() !== 'google user') {
    const localPart = email.split('@')[0]?.trim()
    if (localPart && localPart.toLowerCase() !== 'google user') return localPart
  }

  return fallback
}
