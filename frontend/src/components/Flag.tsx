// Renders a country flag, or nothing when the team has no flag (placeholder /
// knockout slots like "RD32" or "Group A Winner" carry flagUrl === null).
// Centralises the null-check and the onError fallback so no broken-image icon
// or bogus flagcdn request ever reaches the page.
export function Flag({
  url,
  name,
  className,
  eager,
}: {
  url: string | null
  name: string
  className?: string
  eager?: boolean
}) {
  if (!url) return null
  return (
    <img
      src={url}
      alt={name}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      onError={e => {
        ;(e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}
