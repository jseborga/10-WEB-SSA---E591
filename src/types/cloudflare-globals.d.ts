// Tipos de los bindings de Workers sin reemplazar los tipos DOM/Node que usa Next.js.
import type * as Workers from '@cloudflare/workers-types/index.ts'

declare global {
  type D1Database = Workers.D1Database
  type R2Bucket = Workers.R2Bucket
  type R2Range = Workers.R2Range
  type R2GetOptions = Workers.R2GetOptions
  type ImagesBinding = Workers.ImagesBinding
  type ImageTransform = Workers.ImageTransform
  type ImageTransformer = Workers.ImageTransformer
  type Fetcher = Workers.Fetcher
  const FixedLengthStream: typeof Workers.FixedLengthStream
}

export {}
