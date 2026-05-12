export interface ShareLinkPayload {
  title: string
  text?: string
  url: string
}

export async function shareLink(payload: ShareLinkPayload) {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share({
      title: payload.title,
      text: payload.text,
      url: payload.url,
    })
    return 'shared' as const
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(payload.url)
    return 'copied' as const
  }

  throw new Error('share-unavailable')
}
