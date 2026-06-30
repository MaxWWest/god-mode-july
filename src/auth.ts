export function passwordPairError(password: string, confirmation: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (password !== confirmation) return 'The passwords do not match.'
  return null
}
