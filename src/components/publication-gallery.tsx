/** Galería pública de una publicación: grilla responsive simple (sin lightbox). Fotos y videos. */

const VIDEO_URL = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i

export function PublicationGallery({ urls, title }: { urls: string[]; title: string }) {
  if (urls.length === 0) {
    return null
  }

  const single = urls.length === 1

  return (
    <section aria-label="Galería" className="mt-12">
      <div className={single ? 'grid grid-cols-1' : 'grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3'}>
        {urls.map((url, index) => {
          const isVideo = VIDEO_URL.test(url)
          const wide = !single && urls.length % 3 === 1 && index === 0

          return (
            <figure
              key={`${url}-${index}`}
              className={`relative overflow-hidden rounded-2xl bg-zinc-100 ${
                single ? 'aspect-[16/10]' : wide ? 'col-span-2 aspect-[16/10] sm:aspect-[2/1] lg:col-span-3' : 'aspect-square'
              }`}
            >
              {isVideo ? (
                <video src={url} controls playsInline preload="metadata" className="h-full w-full bg-black object-contain" />
              ) : (
                <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                  <img
                    src={url}
                    alt={`${title} — imagen ${index + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                  />
                </a>
              )}
            </figure>
          )
        })}
      </div>
    </section>
  )
}
