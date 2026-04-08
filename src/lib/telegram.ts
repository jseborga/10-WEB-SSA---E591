import path from 'path'
import { db } from '@/lib/db'
import { createAutomationLog, parseStoredJson } from '@/lib/automation-log'
import { createStoredFileName, saveUploadedFile } from '@/lib/media-storage'

const TELEGRAM_API_BASE = 'https://api.telegram.org'

type TelegramPhoto = {
  file_id: string
  file_unique_id?: string
  width?: number
  height?: number
  file_size?: number
}

type TelegramVideo = {
  file_id: string
  file_name?: string
  mime_type?: string
  file_size?: number
}

type TelegramUser = {
  id: number
  username?: string
  first_name?: string
  last_name?: string
}

type TelegramChat = {
  id: number
}

type TelegramMessage = {
  message_id: number
  chat?: TelegramChat
  from?: TelegramUser
  caption?: string
  photo?: TelegramPhoto[]
  video?: TelegramVideo
}

type TelegramUpdate = {
  update_id?: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
}

export function getDefaultTelegramConfig() {
  return {
    enabled: false,
    botToken: '',
    botUsername: '',
    webhookUrl: '',
    webhookSecret: '',
    allowedUserIds: '',
    allowedChatIds: '',
    autoCreateReviews: true,
    autoApproveKnownUsers: false,
    defaultProjectCategory: 'telegram',
    defaultProjectStatus: 'received',
  }
}

export async function ensureTelegramConfig() {
  let config = await db.telegramConfig.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  if (!config) {
    config = await db.telegramConfig.create({
      data: getDefaultTelegramConfig(),
    })
  }

  return config
}

export function parseIdList(value: string | null | undefined) {
  return (value || '')
    .split(/[\n,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function isAllowedValue(value: string, allowed: string[]) {
  if (allowed.length === 0) {
    return true
  }

  return allowed.includes(value)
}

function extractMessage(update: TelegramUpdate) {
  return update.message || update.edited_message || null
}

function getFileExtension(fileName: string | undefined, mimeType: string | undefined, fallback: string) {
  const extFromName = fileName ? path.extname(fileName).toLowerCase() : ''

  if (extFromName) {
    return extFromName
  }

  switch ((mimeType || '').toLowerCase()) {
    case 'image/jpeg':
      return '.jpg'
    case 'image/png':
      return '.png'
    case 'image/webp':
      return '.webp'
    case 'video/mp4':
      return '.mp4'
    case 'video/quicktime':
      return '.mov'
    default:
      return fallback
  }
}

async function telegramApi<T>(botToken: string, method: string, body?: Record<string, unknown>) {
  const endpoint = `${TELEGRAM_API_BASE}/bot${botToken}/${method}`
  const response = await fetch(endpoint, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.ok) {
    const description =
      (typeof data?.description === 'string' && data.description) ||
      `Telegram API error on ${method}`
    throw new Error(description)
  }

  return data.result as T
}

type TelegramFileResult = {
  file_path: string
  file_size?: number
}

async function downloadTelegramFile(botToken: string, fileId: string, fileNameHint: string, mimeType?: string | null) {
  const fileInfo = await telegramApi<TelegramFileResult>(botToken, 'getFile', { file_id: fileId })
  const fileUrl = `${TELEGRAM_API_BASE}/file/bot${botToken}/${fileInfo.file_path}`
  const response = await fetch(fileUrl)

  if (!response.ok) {
    throw new Error('No se pudo descargar el archivo desde Telegram')
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const storedFileName = createStoredFileName(fileNameHint)
  const storagePath = await saveUploadedFile(storedFileName, buffer)

  return {
    fileName: storedFileName,
    storagePath,
    size: fileInfo.file_size || buffer.length,
    url: `/api/media/${storedFileName}`,
  }
}

function createApprovalTitle(caption: string | undefined, mediaCount: number) {
  const firstLine = (caption || '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  if (firstLine) {
    return firstLine.slice(0, 90)
  }

  return mediaCount > 1 ? `Envio de Telegram (${mediaCount} archivos)` : 'Envio de Telegram'
}

function createApprovalSummary(message: TelegramMessage, mediaCount: number) {
  const pieces: string[] = []

  if (message.caption?.trim()) {
    pieces.push(message.caption.trim().slice(0, 220))
  }

  pieces.push(mediaCount > 1 ? `${mediaCount} archivos adjuntos` : '1 archivo adjunto')

  if (message.from?.username) {
    pieces.push(`@${message.from.username}`)
  }

  return pieces.join(' • ')
}

async function storeTelegramIdentity(user: TelegramUser | undefined, isAllowed: boolean) {
  if (!user?.id) {
    return null
  }

  return db.telegramIdentity.upsert({
    where: { telegramUserId: String(user.id) },
    update: {
      username: user.username || null,
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      isAllowed,
      lastSeenAt: new Date(),
    },
    create: {
      telegramUserId: String(user.id),
      username: user.username || null,
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      isAllowed,
      lastSeenAt: new Date(),
    },
  })
}

async function createMediaAssetFromTelegram(
  botToken: string,
  message: TelegramMessage,
  item:
    | { kind: 'image'; fileId: string; fileNameHint: string; mimeType: string }
    | { kind: 'video'; fileId: string; fileNameHint: string; mimeType: string },
) {
  const stored = await downloadTelegramFile(botToken, item.fileId, item.fileNameHint, item.mimeType)

  return db.mediaAsset.create({
    data: {
      source: 'telegram',
      kind: item.kind,
      fileName: stored.fileName,
      originalName: item.fileNameHint,
      mimeType: item.mimeType,
      size: stored.size,
      url: stored.url,
      storagePath: stored.storagePath,
      telegramFileId: item.fileId,
      telegramMessageId: String(message.message_id),
      telegramChatId: message.chat?.id != null ? String(message.chat.id) : null,
      telegramUserId: message.from?.id != null ? String(message.from.id) : null,
      status: 'ready',
      metadata: JSON.stringify({
        caption: message.caption || '',
      }),
    },
  })
}

function buildMediaJobs(message: TelegramMessage) {
  const jobs: Array<{ kind: 'image' | 'video'; fileId: string; fileNameHint: string; mimeType: string }> = []

  const largestPhoto = message.photo && message.photo.length > 0 ? message.photo[message.photo.length - 1] : null

  if (largestPhoto?.file_id) {
    jobs.push({
      kind: 'image',
      fileId: largestPhoto.file_id,
      fileNameHint: `telegram-photo-${largestPhoto.file_id}.jpg`,
      mimeType: 'image/jpeg',
    })
  }

  if (message.video?.file_id) {
    jobs.push({
      kind: 'video',
      fileId: message.video.file_id,
      fileNameHint: message.video.file_name || `telegram-video-${message.video.file_id}.mp4`,
      mimeType: message.video.mime_type || 'video/mp4',
    })
  }

  return jobs
}

export async function syncTelegramWebhook(configOverride?: Awaited<ReturnType<typeof ensureTelegramConfig>>) {
  const config = configOverride || (await ensureTelegramConfig())

  if (!config.botToken || !config.webhookUrl) {
    throw new Error('Configura botToken y webhookUrl antes de sincronizar el webhook')
  }

  const payload: Record<string, unknown> = {
    url: config.webhookUrl,
    allowed_updates: ['message', 'edited_message'],
    drop_pending_updates: false,
  }

  if (config.webhookSecret) {
    payload.secret_token = config.webhookSecret
  }

  const setWebhookResult = await telegramApi<Record<string, unknown>>(config.botToken, 'setWebhook', payload)
  const webhookInfo = await telegramApi<Record<string, unknown>>(config.botToken, 'getWebhookInfo')

  await createAutomationLog({
    source: 'telegram',
    eventType: 'webhook.sync',
    status: 'success',
    summary: 'Webhook de Telegram sincronizado',
    payload: { setWebhookResult, webhookInfo },
  })

  return webhookInfo
}

export async function processTelegramUpdate(rawUpdate: unknown) {
  const config = await ensureTelegramConfig()

  if (!config.enabled || !config.botToken) {
    await createAutomationLog({
      source: 'telegram',
      eventType: 'update.ignored',
      status: 'ignored',
      summary: 'Update recibido con Telegram deshabilitado o sin bot token',
      payload: rawUpdate,
    })
    return { status: 'ignored' as const, reason: 'disabled' }
  }

  const update = (rawUpdate || {}) as TelegramUpdate
  const message = extractMessage(update)

  if (!message) {
    await createAutomationLog({
      source: 'telegram',
      eventType: 'update.ignored',
      status: 'ignored',
      summary: 'Update sin mensaje utilizable',
      payload: update,
    })
    return { status: 'ignored' as const, reason: 'no-message' }
  }

  const userId = message.from?.id != null ? String(message.from.id) : ''
  const chatId = message.chat?.id != null ? String(message.chat.id) : ''
  const allowedUserIds = parseIdList(config.allowedUserIds)
  const allowedChatIds = parseIdList(config.allowedChatIds)
  const isAllowedUser = userId ? isAllowedValue(userId, allowedUserIds) : allowedUserIds.length === 0
  const isAllowedChat = chatId ? isAllowedValue(chatId, allowedChatIds) : allowedChatIds.length === 0
  const isAllowed = isAllowedUser && isAllowedChat

  await storeTelegramIdentity(message.from, isAllowed)

  if (!isAllowed) {
    await createAutomationLog({
      source: 'telegram',
      eventType: 'message.rejected',
      status: 'rejected',
      actorType: 'telegram-user',
      actorId: userId || null,
      summary: 'Mensaje rechazado por listas de acceso',
      payload: {
        updateId: update.update_id,
        userId,
        chatId,
        caption: message.caption || '',
      },
    })

    return { status: 'rejected' as const, reason: 'not-allowed' }
  }

  const jobs = buildMediaJobs(message)

  if (jobs.length === 0) {
    await createAutomationLog({
      source: 'telegram',
      eventType: 'message.ignored',
      status: 'ignored',
      actorType: 'telegram-user',
      actorId: userId || null,
      summary: 'Mensaje recibido sin foto o video',
      payload: {
        updateId: update.update_id,
        caption: message.caption || '',
      },
    })

    return { status: 'ignored' as const, reason: 'no-media' }
  }

  const mediaAssets: Awaited<ReturnType<typeof createMediaAssetFromTelegram>>[] = []

  for (const job of jobs) {
    mediaAssets.push(await createMediaAssetFromTelegram(config.botToken, message, job))
  }

  const approval = config.autoCreateReviews
    ? await db.approvalItem.create({
        data: {
          source: 'telegram',
          entityType: 'incoming-media',
          status: 'pending',
          title: createApprovalTitle(message.caption, mediaAssets.length),
          summary: createApprovalSummary(message, mediaAssets.length),
          details: message.caption || 'Sin descripcion',
          requestedByType: 'telegram-user',
          requestedById: userId || null,
          payload: JSON.stringify({
            caption: message.caption || '',
            chatId,
            messageId: String(message.message_id),
            telegramUserId: userId,
            telegramUsername: message.from?.username || '',
            mediaAssetIds: mediaAssets.map((item) => item.id),
          }),
        },
      })
    : null

  if (approval && config.autoApproveKnownUsers) {
    await approveTelegramReview(approval.id, 'telegram-auto')
  }

  await createAutomationLog({
    source: 'telegram',
    eventType: 'media.received',
    status: approval ? (config.autoApproveKnownUsers ? 'approved' : 'pending') : 'stored',
    actorType: 'telegram-user',
    actorId: userId || null,
    entityType: 'approval',
    entityId: approval?.id || null,
    summary: `Se recibio material desde Telegram${approval ? ' y se genero una revision' : ''}`,
    payload: {
      updateId: update.update_id,
      chatId,
      caption: message.caption || '',
      mediaAssetIds: mediaAssets.map((item) => item.id),
      approvalId: approval?.id || null,
    },
  })

  return {
    status: 'processed' as const,
    approvalId: approval?.id || null,
    mediaAssetIds: mediaAssets.map((item) => item.id),
  }
}

export async function approveTelegramReview(reviewId: string, approvedBy: string) {
  const review = await db.approvalItem.findUnique({
    where: { id: reviewId },
  })

  if (!review) {
    throw new Error('Revision no encontrada')
  }

  if (review.status !== 'pending') {
    throw new Error('La revision ya fue procesada')
  }

  const config = await ensureTelegramConfig()
  const payload = parseStoredJson<{
    caption?: string
    telegramUsername?: string
    telegramUserId?: string
    mediaAssetIds?: string[]
  }>(review.payload, {})

  const mediaAssetIds = Array.isArray(payload.mediaAssetIds) ? payload.mediaAssetIds : []

  if (mediaAssetIds.length === 0) {
    throw new Error('La revision no tiene assets asociados')
  }

  const assets = await db.mediaAsset.findMany({
    where: {
      id: {
        in: mediaAssetIds,
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (assets.length === 0) {
    throw new Error('No se encontraron los medios asociados')
  }

  const firstImage = assets.find((asset) => asset.kind === 'image') || null
  const firstVideo = assets.find((asset) => asset.kind === 'video') || null
  const gallery = assets.filter((asset) => asset.kind === 'image').map((asset) => asset.url)
  const caption = (payload.caption || review.details || '').trim()
  const firstCaptionLine = caption.split('\n').map((line) => line.trim()).find(Boolean)

  const project = await db.project.create({
    data: {
      title: firstCaptionLine || review.title || `Proyecto ${new Date().toLocaleDateString('es-BO')}`,
      description: caption || review.summary || 'Material recibido por Telegram.',
      fullDescription: caption || review.details || 'Material recibido por Telegram.',
      category: config.defaultProjectCategory || 'telegram',
      mainImage: firstImage?.url || null,
      gallery: gallery.length > 0 ? JSON.stringify(gallery) : null,
      videoUrl: firstVideo?.url || null,
      client: payload.telegramUsername ? `Telegram @${payload.telegramUsername}` : payload.telegramUserId ? `Telegram ${payload.telegramUserId}` : null,
      status: config.defaultProjectStatus || 'received',
      published: false,
      featured: false,
      showOnHomepage: false,
    },
  })

  await db.approvalItem.update({
    where: { id: review.id },
    data: {
      status: 'approved',
      entityType: 'project',
      entityId: project.id,
      approvedBy,
      approvedAt: new Date(),
    },
  })

  await createAutomationLog({
    source: 'telegram',
    eventType: 'review.approved',
    status: 'success',
    actorType: 'admin-user',
    actorId: approvedBy,
    entityType: 'project',
    entityId: project.id,
    summary: `Revision aprobada y convertida en borrador de proyecto: ${project.title}`,
    payload: {
      reviewId: review.id,
      mediaAssetIds,
    },
  })

  return project
}

export async function rejectTelegramReview(reviewId: string, approvedBy: string, reason?: string) {
  const review = await db.approvalItem.findUnique({
    where: { id: reviewId },
  })

  if (!review) {
    throw new Error('Revision no encontrada')
  }

  if (review.status !== 'pending') {
    throw new Error('La revision ya fue procesada')
  }

  const updated = await db.approvalItem.update({
    where: { id: reviewId },
    data: {
      status: 'rejected',
      approvedBy,
      rejectedAt: new Date(),
      rejectionReason: reason || null,
    },
  })

  await createAutomationLog({
    source: 'telegram',
    eventType: 'review.rejected',
    status: 'success',
    actorType: 'admin-user',
    actorId: approvedBy,
    entityType: 'approval',
    entityId: reviewId,
    summary: 'Revision rechazada',
    payload: {
      reason: reason || '',
    },
  })

  return updated
}
