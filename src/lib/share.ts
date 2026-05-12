export interface ShareLinkPayload {
  title: string
  text?: string
  url: string
}

export function buildSocialShareLinks(payload: ShareLinkPayload) {
  const encodedUrl = encodeURIComponent(payload.url)
  const encodedTitle = encodeURIComponent(payload.title)
  const encodedText = encodeURIComponent(payload.text || payload.title)
  const combinedText = encodeURIComponent(`${payload.title} ${payload.url}`)

  return {
    whatsapp: `https://wa.me/?text=${combinedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
  }
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
