import { db } from '@/lib/db'
import { createAutomationLog, parseStoredJson } from '@/lib/automation-log'
import { createStoredFileName, saveUploadedFile } from '@/lib/media-storage'
import { parseUrlList } from '@/lib/public-site'
import { ensureSiteSettings } from '@/lib/site-settings'

const TELEGRAM_API_BASE = 'https://api.telegram.org'

const MAIN_MENU_LABELS = {
  hero: 'Portada',
  project: 'Proyecto nuevo',
  projectMedia: 'Agregar a proyecto',
  status: 'Estado',
  cancel: 'Cancelar',
} as const

const HERO_SLOT_LABELS = {
  primary: 'Principal',
  secondary: 'Secundario',
} as const

const HERO_DEVICE_LABELS = {
  desktop: 'Desktop',
  mobile: 'Mobile',
  both: 'Ambos',
} as const

const PROJECT_MEDIA_ROLE_LABELS = {
  primary: 'Principal',
  mobile: 'Mobile',
  gallery: 'Galeria',
  video: 'Video',
} as const

const YES_LABELS = {
  yes: 'Si',
  no: 'No',
  skip: 'Omitir',
  send: 'Enviar',
} as const

const PROJECT_CATEGORY_OPTIONS = ['construccion', 'diseno', 'supervision', 'asesoria', 'software', 'erp']

type TelegramPhoto = {
  file_id: string
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
  text?: string
  caption?: string
  photo?: TelegramPhoto[]
  video?: TelegramVideo
}

type TelegramUpdate = {
  update_id?: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
}

type TelegramReplyKeyboard = {
  keyboard: Array<Array<{ text: string }>>
  resize_keyboard?: boolean
  one_time_keyboard?: boolean
}

type ConversationDraft = {
  workflowType?: 'hero' | 'project' | 'project-media'
  heroSlot?: 'primary' | 'secondary'
  heroDevice?: 'desktop' | 'mobile' | 'both'
  note?: string
  title?: string
  category?: string
  location?: string
  year?: string
  client?: string
  description?: string
  fullDescription?: string
  showOnHomepage?: boolean
  targetProjectId?: string
  targetProjectTitle?: string
  targetMediaRole?: 'primary' | 'mobile' | 'gallery' | 'video'
  mediaAssetIds?: string[]
}

type MediaAssetRecord = {
  id: string
  kind: string
  url: string
  createdAt: Date
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

function normalizeText(value: string | undefined | null) {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function replyKeyboard(rows: string[][], oneTimeKeyboard = true): TelegramReplyKeyboard {
  return {
    keyboard: rows.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
    one_time_keyboard: oneTimeKeyboard,
  }
}

function mainMenuKeyboard() {
  return replyKeyboard(
    [
      [MAIN_MENU_LABELS.hero, MAIN_MENU_LABELS.project],
      [MAIN_MENU_LABELS.projectMedia],
      [MAIN_MENU_LABELS.status, MAIN_MENU_LABELS.cancel],
    ],
    false,
  )
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

function isMediaMessage(message: TelegramMessage) {
  return Boolean((message.photo && message.photo.length > 0) || message.video?.file_id)
}

function getConversationDraft(value: string | null | undefined) {
  return parseStoredJson<ConversationDraft>(value, {})
}

async function updateConversation(
  telegramUserId: string,
  data: {
    chatId?: string
    flowType?: string | null
    step?: string | null
    status?: string
    draftData?: ConversationDraft
  },
) {
  return db.telegramConversation.update({
    where: { telegramUserId },
    data: {
      chatId: data.chatId,
      flowType: data.flowType ?? undefined,
      step: data.step ?? undefined,
      status: data.status,
      draftData: data.draftData ? JSON.stringify(data.draftData) : data.draftData === undefined ? undefined : null,
    },
  })
}

async function getOrCreateConversation(telegramUserId: string, chatId: string) {
  return db.telegramConversation.upsert({
    where: { telegramUserId },
    update: {
      chatId,
    },
    create: {
      telegramUserId,
      chatId,
      status: 'idle',
    },
  })
}

async function resetConversation(telegramUserId: string, chatId: string) {
  return updateConversation(telegramUserId, {
    chatId,
    flowType: null,
    step: null,
    status: 'idle',
    draftData: {},
  })
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
    throw new Error(
      (typeof data?.description === 'string' && data.description) || `Telegram API error on ${method}`,
    )
  }

  return data.result as T
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  keyboard?: TelegramReplyKeyboard,
) {
  return telegramApi(botToken, 'sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: keyboard,
  })
}

type TelegramFileResult = {
  file_path: string
  file_size?: number
}

async function downloadTelegramFile(botToken: string, fileId: string, fileNameHint: string) {
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

async function createMediaAssetFromTelegram(
  botToken: string,
  message: TelegramMessage,
  item: { kind: 'image' | 'video'; fileId: string; fileNameHint: string; mimeType: string },
) {
  const stored = await downloadTelegramFile(botToken, item.fileId, item.fileNameHint)

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

async function startFlow(
  botToken: string,
  chatId: string,
  telegramUserId: string,
  flowType: 'hero' | 'project' | 'project-media',
) {
  if (flowType === 'hero') {
    await updateConversation(telegramUserId, {
      chatId,
      flowType,
      step: 'hero-slot',
      status: 'active',
      draftData: { workflowType: 'hero', mediaAssetIds: [] },
    })

    await sendTelegramMessage(
      botToken,
      chatId,
      'Vamos a cargar material para la portada. Primero elige si este medio será principal o secundario.',
      replyKeyboard([[HERO_SLOT_LABELS.primary, HERO_SLOT_LABELS.secondary], [MAIN_MENU_LABELS.cancel]], true),
    )

    return
  }

  if (flowType === 'project') {
    await updateConversation(telegramUserId, {
      chatId,
      flowType,
      step: 'project-title',
      status: 'active',
      draftData: { workflowType: 'project', mediaAssetIds: [] },
    })

    await sendTelegramMessage(botToken, chatId, 'Vamos a crear un proyecto nuevo. Envia primero el titulo del proyecto.', mainMenuKeyboard())
    return
  }

  await updateConversation(telegramUserId, {
    chatId,
    flowType,
    step: 'project-media-target',
    status: 'active',
    draftData: { workflowType: 'project-media', mediaAssetIds: [] },
  })

  await sendTelegramMessage(
    botToken,
    chatId,
    'Vamos a agregar material a un proyecto existente. Envia el ID exacto o una parte clara del titulo del proyecto.',
    mainMenuKeyboard(),
  )
}

function buildConversationStatusText(conversation: Awaited<ReturnType<typeof getOrCreateConversation>>) {
  if (conversation.status !== 'active' || !conversation.flowType || !conversation.step) {
    return 'No hay un flujo activo. Usa /nuevo para empezar.'
  }

  const draft = getConversationDraft(conversation.draftData)
  const mediaCount = draft.mediaAssetIds?.length || 0

  return [
    `Flujo activo: ${conversation.flowType}`,
    `Paso actual: ${conversation.step}`,
    mediaCount > 0 ? `Archivos adjuntos: ${mediaCount}` : 'Todavia no hay archivos adjuntos.',
  ].join('\n')
}

async function findProjectByReference(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return { status: 'empty' as const, projects: [] as Array<{ id: string; title: string }> }
  }

  const exact = await db.project.findFirst({
    where: {
      OR: [{ id: trimmed }, { title: trimmed }],
    },
    orderBy: { createdAt: 'desc' },
  })

  if (exact) {
    return { status: 'single' as const, projects: [{ id: exact.id, title: exact.title }] }
  }

  const candidates = await db.project.findMany({
    where: {
      title: { contains: trimmed },
    },
    select: {
      id: true,
      title: true,
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  })

  if (candidates.length === 1) {
    return { status: 'single' as const, projects: candidates }
  }

  if (candidates.length > 1) {
    return { status: 'multiple' as const, projects: candidates }
  }

  return { status: 'none' as const, projects: [] as Array<{ id: string; title: string }> }
}

async function appendConversationMedia(
  botToken: string,
  conversation: Awaited<ReturnType<typeof getOrCreateConversation>>,
  message: TelegramMessage,
) {
  const jobs = buildMediaJobs(message)

  if (jobs.length === 0) {
    return [] as MediaAssetRecord[]
  }

  const mediaAssets: MediaAssetRecord[] = []

  for (const job of jobs) {
    mediaAssets.push(await createMediaAssetFromTelegram(botToken, message, job))
  }

  const draft = getConversationDraft(conversation.draftData)
  await updateConversation(conversation.telegramUserId, {
    chatId: conversation.chatId,
    draftData: {
      ...draft,
      mediaAssetIds: [...(draft.mediaAssetIds || []), ...mediaAssets.map((asset) => asset.id)],
    },
  })

  return mediaAssets
}

async function createWorkflowReview(
  config: Awaited<ReturnType<typeof ensureTelegramConfig>>,
  message: TelegramMessage,
  workflowTitle: string,
  workflowSummary: string,
  workflowDetails: string,
  payload: Record<string, unknown>,
) {
  const approval = await db.approvalItem.create({
    data: {
      source: 'telegram',
      entityType: String(payload.workflowType || 'telegram-workflow'),
      status: 'pending',
      title: workflowTitle,
      summary: workflowSummary,
      details: workflowDetails,
      requestedByType: 'telegram-user',
      requestedById: message.from?.id != null ? String(message.from.id) : null,
      payload: JSON.stringify(payload),
    },
  })

  if (!config.autoCreateReviews || config.autoApproveKnownUsers) {
    await approveTelegramReview(approval.id, config.autoApproveKnownUsers ? 'telegram-auto' : 'telegram-direct')
  }

  return approval
}

function joinTextLines(lines: Array<string | null | undefined>) {
  return lines
    .map((line) => (line || '').trim())
    .filter(Boolean)
    .join('\n')
}

async function finalizeConversation(
  config: Awaited<ReturnType<typeof ensureTelegramConfig>>,
  conversation: Awaited<ReturnType<typeof getOrCreateConversation>>,
  message: TelegramMessage,
) {
  const draft = getConversationDraft(conversation.draftData)
  const mediaAssetIds = draft.mediaAssetIds || []

  if (mediaAssetIds.length === 0) {
    await sendTelegramMessage(config.botToken || '', conversation.chatId, 'Todavia no has enviado archivos. Envia una foto o video primero.')
    return { status: 'waiting-media' as const }
  }

  let approval = null as Awaited<ReturnType<typeof createWorkflowReview>> | null

  if (draft.workflowType === 'hero') {
    approval = await createWorkflowReview(
      config,
      message,
      `Portada ${draft.heroSlot === 'secondary' ? 'secundaria' : 'principal'}`,
      `Destino: ${draft.heroDevice || 'desktop'} • ${mediaAssetIds.length} archivo(s)`,
      draft.note || 'Sin nota adicional.',
      {
        workflowType: 'hero',
        heroSlot: draft.heroSlot || 'primary',
        heroDevice: draft.heroDevice || 'desktop',
        note: draft.note || '',
        mediaAssetIds,
      },
    )
  } else if (draft.workflowType === 'project') {
    approval = await createWorkflowReview(
      config,
      message,
      draft.title || 'Proyecto nuevo desde Telegram',
      `${draft.category || config.defaultProjectCategory || 'telegram'} • ${mediaAssetIds.length} archivo(s)`,
      joinTextLines([draft.description, draft.fullDescription]),
      {
        workflowType: 'project',
        title: draft.title || '',
        category: draft.category || config.defaultProjectCategory || 'telegram',
        location: draft.location || '',
        year: draft.year || '',
        client: draft.client || '',
        description: draft.description || '',
        fullDescription: draft.fullDescription || '',
        showOnHomepage: Boolean(draft.showOnHomepage),
        mediaAssetIds,
      },
    )
  } else if (draft.workflowType === 'project-media') {
    approval = await createWorkflowReview(
      config,
      message,
      `Agregar material a ${draft.targetProjectTitle || 'proyecto'}`,
      `${draft.targetMediaRole || 'gallery'} • ${mediaAssetIds.length} archivo(s)`,
      draft.note || 'Material adicional enviado por Telegram.',
      {
        workflowType: 'project-media',
        targetProjectId: draft.targetProjectId || '',
        targetProjectTitle: draft.targetProjectTitle || '',
        targetMediaRole: draft.targetMediaRole || 'gallery',
        note: draft.note || '',
        mediaAssetIds,
      },
    )
  }

  await createAutomationLog({
    source: 'telegram',
    eventType: 'workflow.submitted',
    status: config.autoCreateReviews ? 'pending' : 'approved',
    actorType: 'telegram-user',
    actorId: message.from?.id != null ? String(message.from.id) : null,
    entityType: 'approval',
    entityId: approval?.id || null,
    summary: `Flujo ${draft.workflowType || 'telegram'} enviado`,
    payload: {
      workflowType: draft.workflowType,
      mediaAssetIds,
    },
  })

  await resetConversation(conversation.telegramUserId, conversation.chatId)

  await sendTelegramMessage(
    config.botToken || '',
    conversation.chatId,
    config.autoCreateReviews
      ? 'Listo. El contenido fue enviado a revision en el panel admin.'
      : 'Listo. El contenido fue procesado directamente.',
    mainMenuKeyboard(),
  )

  return { status: 'submitted' as const, approvalId: approval?.id || null }
}

async function handleCommand(
  config: Awaited<ReturnType<typeof ensureTelegramConfig>>,
  conversation: Awaited<ReturnType<typeof getOrCreateConversation>>,
  normalizedText: string,
) {
  const chatId = conversation.chatId

  if (normalizedText === '/start' || normalizedText === '/ayuda') {
    await resetConversation(conversation.telegramUserId, chatId)
    await sendTelegramMessage(
      config.botToken || '',
      chatId,
      'Bot listo. Usa /nuevo para comenzar o elige una opcion del menu.',
      mainMenuKeyboard(),
    )
    return { handled: true as const }
  }

  if (normalizedText === '/cancelar' || normalizedText === normalizeText(MAIN_MENU_LABELS.cancel)) {
    await resetConversation(conversation.telegramUserId, chatId)
    await sendTelegramMessage(config.botToken || '', chatId, 'Flujo cancelado.', mainMenuKeyboard())
    return { handled: true as const }
  }

  if (normalizedText === '/estado' || normalizedText === normalizeText(MAIN_MENU_LABELS.status)) {
    await sendTelegramMessage(config.botToken || '', chatId, buildConversationStatusText(conversation), mainMenuKeyboard())
    return { handled: true as const }
  }

  if (normalizedText === '/nuevo') {
    await resetConversation(conversation.telegramUserId, chatId)
    await sendTelegramMessage(
      config.botToken || '',
      chatId,
      '¿Que quieres publicar?',
      replyKeyboard(
        [
          [MAIN_MENU_LABELS.hero, MAIN_MENU_LABELS.project],
          [MAIN_MENU_LABELS.projectMedia],
          [MAIN_MENU_LABELS.cancel],
        ],
        true,
      ),
    )
    return { handled: true as const }
  }

  if (normalizedText === '/portada' || normalizedText === normalizeText(MAIN_MENU_LABELS.hero)) {
    await startFlow(config.botToken || '', chatId, conversation.telegramUserId, 'hero')
    return { handled: true as const }
  }

  if (normalizedText === '/proyecto' || normalizedText === normalizeText(MAIN_MENU_LABELS.project)) {
    await startFlow(config.botToken || '', chatId, conversation.telegramUserId, 'project')
    return { handled: true as const }
  }

  if (normalizedText === '/agregar' || normalizedText === normalizeText(MAIN_MENU_LABELS.projectMedia)) {
    await startFlow(config.botToken || '', chatId, conversation.telegramUserId, 'project-media')
    return { handled: true as const }
  }

  return { handled: false as const }
}

async function handleConversationStep(
  config: Awaited<ReturnType<typeof ensureTelegramConfig>>,
  conversation: Awaited<ReturnType<typeof getOrCreateConversation>>,
  message: TelegramMessage,
) {
  if (conversation.status !== 'active' || !conversation.step) {
    return { handled: false as const }
  }

  const text = (message.text || message.caption || '').trim()
  const normalizedText = normalizeText(text)
  const draft = getConversationDraft(conversation.draftData)

  if (conversation.step === 'hero-slot') {
    const heroSlot =
      normalizedText === normalizeText(HERO_SLOT_LABELS.secondary) ? 'secondary' : normalizedText === normalizeText(HERO_SLOT_LABELS.primary) ? 'primary' : null

    if (!heroSlot) {
      await sendTelegramMessage(
        config.botToken || '',
        conversation.chatId,
        'Elige si el material es principal o secundario.',
        replyKeyboard([[HERO_SLOT_LABELS.primary, HERO_SLOT_LABELS.secondary], [MAIN_MENU_LABELS.cancel]], true),
      )
      return { handled: true as const }
    }

    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'hero-device',
      draftData: { ...draft, heroSlot },
    })

    await sendTelegramMessage(
      config.botToken || '',
      conversation.chatId,
      '¿Para que version de portada es este material?',
      replyKeyboard([[HERO_DEVICE_LABELS.desktop, HERO_DEVICE_LABELS.mobile, HERO_DEVICE_LABELS.both], [MAIN_MENU_LABELS.cancel]], true),
    )

    return { handled: true as const }
  }

  if (conversation.step === 'hero-device') {
    const heroDevice =
      normalizedText === normalizeText(HERO_DEVICE_LABELS.mobile)
        ? 'mobile'
        : normalizedText === normalizeText(HERO_DEVICE_LABELS.both)
          ? 'both'
          : normalizedText === normalizeText(HERO_DEVICE_LABELS.desktop)
            ? 'desktop'
            : null

    if (!heroDevice) {
      await sendTelegramMessage(
        config.botToken || '',
        conversation.chatId,
        'Elige Desktop, Mobile o Ambos.',
        replyKeyboard([[HERO_DEVICE_LABELS.desktop, HERO_DEVICE_LABELS.mobile, HERO_DEVICE_LABELS.both], [MAIN_MENU_LABELS.cancel]], true),
      )
      return { handled: true as const }
    }

    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'hero-note',
      draftData: { ...draft, heroDevice },
    })

    await sendTelegramMessage(
      config.botToken || '',
      conversation.chatId,
      'Escribe una nota breve para la revision o responde Omitir.',
      replyKeyboard([[YES_LABELS.skip], [MAIN_MENU_LABELS.cancel]], true),
    )

    return { handled: true as const }
  }

  if (conversation.step === 'hero-note') {
    const note = normalizedText === normalizeText(YES_LABELS.skip) ? '' : text

    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'hero-media',
      draftData: { ...draft, note },
    })

    await sendTelegramMessage(
      config.botToken || '',
      conversation.chatId,
      'Ahora envia una o varias fotos o videos para la portada. Cuando termines, escribe Enviar.',
      replyKeyboard([[YES_LABELS.send], [MAIN_MENU_LABELS.cancel]], false),
    )

    return { handled: true as const }
  }

  if (conversation.step === 'project-title') {
    if (!text) {
      await sendTelegramMessage(config.botToken || '', conversation.chatId, 'Envia un titulo valido para el proyecto.')
      return { handled: true as const }
    }

    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'project-category',
      draftData: { ...draft, title: text },
    })

    await sendTelegramMessage(
      config.botToken || '',
      conversation.chatId,
      'Elige la categoria del proyecto o escribe otra categoria.',
      replyKeyboard([PROJECT_CATEGORY_OPTIONS.map((item) => item[0].toUpperCase() + item.slice(1)), [MAIN_MENU_LABELS.cancel]], true),
    )

    return { handled: true as const }
  }

  if (conversation.step === 'project-category') {
    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'project-location',
      draftData: { ...draft, category: text || config.defaultProjectCategory || 'telegram' },
    })

    await sendTelegramMessage(config.botToken || '', conversation.chatId, 'Ubicacion del proyecto:', mainMenuKeyboard())
    return { handled: true as const }
  }

  if (conversation.step === 'project-location') {
    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'project-year',
      draftData: { ...draft, location: text },
    })

    await sendTelegramMessage(config.botToken || '', conversation.chatId, 'Año del proyecto. Si no aplica, responde Omitir.', replyKeyboard([[YES_LABELS.skip], [MAIN_MENU_LABELS.cancel]], true))
    return { handled: true as const }
  }

  if (conversation.step === 'project-year') {
    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'project-client',
      draftData: { ...draft, year: normalizedText === normalizeText(YES_LABELS.skip) ? '' : text },
    })

    await sendTelegramMessage(config.botToken || '', conversation.chatId, 'Cliente o propietario. Si no aplica, responde Omitir.', replyKeyboard([[YES_LABELS.skip], [MAIN_MENU_LABELS.cancel]], true))
    return { handled: true as const }
  }

  if (conversation.step === 'project-client') {
    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'project-description',
      draftData: { ...draft, client: normalizedText === normalizeText(YES_LABELS.skip) ? '' : text },
    })

    await sendTelegramMessage(config.botToken || '', conversation.chatId, 'Escribe una descripcion corta del proyecto.')
    return { handled: true as const }
  }

  if (conversation.step === 'project-description') {
    if (!text) {
      await sendTelegramMessage(config.botToken || '', conversation.chatId, 'La descripcion corta no puede quedar vacia.')
      return { handled: true as const }
    }

    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'project-full-description',
      draftData: { ...draft, description: text },
    })

    await sendTelegramMessage(config.botToken || '', conversation.chatId, 'Escribe una descripcion mas amplia o responde Omitir.', replyKeyboard([[YES_LABELS.skip], [MAIN_MENU_LABELS.cancel]], true))
    return { handled: true as const }
  }

  if (conversation.step === 'project-full-description') {
    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'project-homepage',
      draftData: { ...draft, fullDescription: normalizedText === normalizeText(YES_LABELS.skip) ? '' : text },
    })

    await sendTelegramMessage(config.botToken || '', conversation.chatId, '¿Debe aparecer en la portada?', replyKeyboard([[YES_LABELS.yes, YES_LABELS.no], [MAIN_MENU_LABELS.cancel]], true))
    return { handled: true as const }
  }

  if (conversation.step === 'project-homepage') {
    const showOnHomepage =
      normalizedText === normalizeText(YES_LABELS.yes) ? true : normalizedText === normalizeText(YES_LABELS.no) ? false : null

    if (showOnHomepage == null) {
      await sendTelegramMessage(config.botToken || '', conversation.chatId, 'Responde Si o No.', replyKeyboard([[YES_LABELS.yes, YES_LABELS.no], [MAIN_MENU_LABELS.cancel]], true))
      return { handled: true as const }
    }

    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'project-media',
      draftData: { ...draft, showOnHomepage },
    })

    await sendTelegramMessage(
      config.botToken || '',
      conversation.chatId,
      'Ahora envia fotos o videos del proyecto. La primera imagen quedara como principal, las siguientes iran a galeria y el primer video quedara como video principal. Cuando termines, escribe Enviar.',
      replyKeyboard([[YES_LABELS.send], [MAIN_MENU_LABELS.cancel]], false),
    )

    return { handled: true as const }
  }

  if (conversation.step === 'project-media-target') {
    const result = await findProjectByReference(text)

    if (result.status === 'none') {
      await sendTelegramMessage(config.botToken || '', conversation.chatId, 'No encontre ese proyecto. Envia el ID exacto o una parte mas clara del titulo.')
      return { handled: true as const }
    }

    if (result.status === 'multiple') {
      const listing = result.projects.map((project) => `- ${project.id} | ${project.title}`).join('\n')
      await sendTelegramMessage(config.botToken || '', conversation.chatId, `Encontre varias coincidencias. Responde con el ID exacto:\n${listing}`)
      return { handled: true as const }
    }

    const project = result.projects[0]
    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'project-media-role',
      draftData: { ...draft, targetProjectId: project.id, targetProjectTitle: project.title },
    })

    await sendTelegramMessage(
      config.botToken || '',
      conversation.chatId,
      `Proyecto seleccionado: ${project.title}. ¿Que tipo de material vas a agregar?`,
      replyKeyboard(
        [[PROJECT_MEDIA_ROLE_LABELS.primary, PROJECT_MEDIA_ROLE_LABELS.mobile], [PROJECT_MEDIA_ROLE_LABELS.gallery, PROJECT_MEDIA_ROLE_LABELS.video], [MAIN_MENU_LABELS.cancel]],
        true,
      ),
    )
    return { handled: true as const }
  }

  if (conversation.step === 'project-media-role') {
    const role =
      normalizedText === normalizeText(PROJECT_MEDIA_ROLE_LABELS.primary)
        ? 'primary'
        : normalizedText === normalizeText(PROJECT_MEDIA_ROLE_LABELS.mobile)
          ? 'mobile'
          : normalizedText === normalizeText(PROJECT_MEDIA_ROLE_LABELS.gallery)
            ? 'gallery'
            : normalizedText === normalizeText(PROJECT_MEDIA_ROLE_LABELS.video)
              ? 'video'
              : null

    if (!role) {
      await sendTelegramMessage(config.botToken || '', conversation.chatId, 'Elige Principal, Mobile, Galeria o Video.')
      return { handled: true as const }
    }

    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'project-media-note',
      draftData: { ...draft, targetMediaRole: role },
    })

    await sendTelegramMessage(config.botToken || '', conversation.chatId, 'Escribe una nota breve para la revision o responde Omitir.', replyKeyboard([[YES_LABELS.skip], [MAIN_MENU_LABELS.cancel]], true))
    return { handled: true as const }
  }

  if (conversation.step === 'project-media-note') {
    await updateConversation(conversation.telegramUserId, {
      chatId: conversation.chatId,
      step: 'project-media-upload',
      draftData: { ...draft, note: normalizedText === normalizeText(YES_LABELS.skip) ? '' : text },
    })

    await sendTelegramMessage(
      config.botToken || '',
      conversation.chatId,
      'Ahora envia los archivos para ese proyecto. Cuando termines, escribe Enviar.',
      replyKeyboard([[YES_LABELS.send], [MAIN_MENU_LABELS.cancel]], false),
    )
    return { handled: true as const }
  }

  if (['hero-media', 'project-media', 'project-media-upload'].includes(conversation.step)) {
    if (normalizedText === normalizeText(YES_LABELS.send) || normalizedText === '/enviar') {
      await finalizeConversation(config, conversation, message)
      return { handled: true as const }
    }

    if (!isMediaMessage(message)) {
      await sendTelegramMessage(config.botToken || '', conversation.chatId, 'Envia una foto o video, o escribe Enviar cuando termines.')
      return { handled: true as const }
    }

    const assets = await appendConversationMedia(config.botToken || '', conversation, message)

    await createAutomationLog({
      source: 'telegram',
      eventType: 'workflow.media-attached',
      status: 'success',
      actorType: 'telegram-user',
      actorId: message.from?.id != null ? String(message.from.id) : null,
      summary: `Se adjuntaron ${assets.length} archivo(s) al flujo guiado`,
      payload: {
        flowType: conversation.flowType,
        step: conversation.step,
        mediaAssetIds: assets.map((asset) => asset.id),
      },
    })

    await sendTelegramMessage(
      config.botToken || '',
      conversation.chatId,
      `Recibi ${assets.length} archivo(s). Puedes enviar mas o escribir Enviar para terminar.`,
      replyKeyboard([[YES_LABELS.send], [MAIN_MENU_LABELS.cancel]], false),
    )
    return { handled: true as const }
  }

  return { handled: false as const }
}

function mergeMediaList(currentValue: string | null | undefined, newUrls: string[], position: 'prepend' | 'append') {
  const current = parseUrlList(currentValue)
  const merged = position === 'prepend' ? [...newUrls, ...current] : [...current, ...newUrls]
  return JSON.stringify(Array.from(new Set(merged)))
}

async function applyHeroApproval(payload: {
  heroSlot?: 'primary' | 'secondary'
  heroDevice?: 'desktop' | 'mobile' | 'both'
  mediaAssetIds?: string[]
}) {
  const settings = await ensureSiteSettings()
  const mediaAssetIds = Array.isArray(payload.mediaAssetIds) ? payload.mediaAssetIds : []
  const assets = await db.mediaAsset.findMany({
    where: { id: { in: mediaAssetIds } },
    orderBy: { createdAt: 'asc' },
  })
  const urls = assets.map((asset) => asset.url)
  const position = payload.heroSlot === 'secondary' ? 'append' : 'prepend'
  const updateData: Record<string, string> = {}

  if (payload.heroDevice === 'desktop' || payload.heroDevice === 'both' || !payload.heroDevice) {
    updateData.heroImages = mergeMediaList(settings.heroImages, urls, position)
  }

  if (payload.heroDevice === 'mobile' || payload.heroDevice === 'both') {
    updateData.heroImagesMobile = mergeMediaList(settings.heroImagesMobile || settings.heroImages, urls, position)
  }

  const updated = await db.siteSettings.update({
    where: { id: settings.id },
    data: updateData,
  })

  return { entityType: 'site-settings', entityId: updated.id, summary: 'Portada actualizada' }
}

async function applyProjectApproval(
  config: Awaited<ReturnType<typeof ensureTelegramConfig>>,
  payload: {
    title?: string
    category?: string
    location?: string
    year?: string
    client?: string
    description?: string
    fullDescription?: string
    showOnHomepage?: boolean
    mediaAssetIds?: string[]
  },
) {
  const mediaAssetIds = Array.isArray(payload.mediaAssetIds) ? payload.mediaAssetIds : []
  const assets = await db.mediaAsset.findMany({
    where: { id: { in: mediaAssetIds } },
    orderBy: { createdAt: 'asc' },
  })
  const images = assets.filter((asset) => asset.kind === 'image')
  const videos = assets.filter((asset) => asset.kind === 'video')
  const mainImage = images[0]?.url || null
  const gallery = images.slice(1).map((asset) => asset.url)
  const videoUrl = videos[0]?.url || null
  const parsedYear = payload.year ? Number.parseInt(payload.year, 10) : null

  const project = await db.project.create({
    data: {
      title: payload.title || 'Proyecto desde Telegram',
      description: payload.description || null,
      fullDescription: payload.fullDescription || payload.description || null,
      category: payload.category || config.defaultProjectCategory || 'telegram',
      location: payload.location || null,
      year: Number.isFinite(parsedYear) ? parsedYear : null,
      client: payload.client || null,
      showOnHomepage: Boolean(payload.showOnHomepage),
      status: config.defaultProjectStatus || 'received',
      mainImage,
      gallery: gallery.length > 0 ? JSON.stringify(gallery) : null,
      videoUrl,
      published: false,
      featured: false,
    },
  })

  return { entityType: 'project', entityId: project.id, summary: `Proyecto creado: ${project.title}` }
}

async function applyProjectMediaApproval(payload: {
  targetProjectId?: string
  targetMediaRole?: 'primary' | 'mobile' | 'gallery' | 'video'
  mediaAssetIds?: string[]
}) {
  if (!payload.targetProjectId) {
    throw new Error('No se encontro el proyecto destino')
  }

  const project = await db.project.findUnique({
    where: { id: payload.targetProjectId },
  })

  if (!project) {
    throw new Error('El proyecto destino ya no existe')
  }

  const mediaAssetIds = Array.isArray(payload.mediaAssetIds) ? payload.mediaAssetIds : []
  const assets = await db.mediaAsset.findMany({
    where: { id: { in: mediaAssetIds } },
    orderBy: { createdAt: 'asc' },
  })

  const firstImage = assets.find((asset) => asset.kind === 'image') || null
  const galleryImages = assets.filter((asset) => asset.kind === 'image').map((asset) => asset.url)
  const firstVideo = assets.find((asset) => asset.kind === 'video') || null
  const updateData: Record<string, string | null> = {}

  switch (payload.targetMediaRole) {
    case 'primary':
      updateData.mainImage = firstImage?.url || project.mainImage || null
      break
    case 'mobile':
      updateData.mainImageMobile = firstImage?.url || project.mainImageMobile || null
      break
    case 'video':
      updateData.videoUrl = firstVideo?.url || project.videoUrl || null
      break
    case 'gallery':
    default:
      updateData.gallery = mergeMediaList(project.gallery, galleryImages, 'append')
      break
  }

  const updated = await db.project.update({
    where: { id: project.id },
    data: updateData,
  })

  return { entityType: 'project', entityId: updated.id, summary: `Proyecto actualizado: ${updated.title}` }
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

  const commands = [
    { command: 'nuevo', description: 'Iniciar flujo guiado de publicacion' },
    { command: 'portada', description: 'Cargar material para portada' },
    { command: 'proyecto', description: 'Crear proyecto nuevo' },
    { command: 'agregar', description: 'Agregar material a un proyecto existente' },
    { command: 'estado', description: 'Ver el estado del flujo actual' },
    { command: 'cancelar', description: 'Cancelar el flujo actual' },
    { command: 'ayuda', description: 'Ver opciones del bot' },
  ]

  const setWebhookResult = await telegramApi<Record<string, unknown>>(config.botToken, 'setWebhook', payload)
  const commandsResult = await telegramApi<Record<string, unknown>>(config.botToken, 'setMyCommands', { commands })
  const webhookInfo = await telegramApi<Record<string, unknown>>(config.botToken, 'getWebhookInfo')

  await createAutomationLog({
    source: 'telegram',
    eventType: 'webhook.sync',
    status: 'success',
    summary: 'Webhook de Telegram sincronizado',
    payload: { setWebhookResult, commandsResult, webhookInfo },
  })

  return webhookInfo
}

async function processFastMediaMessage(
  config: Awaited<ReturnType<typeof ensureTelegramConfig>>,
  message: TelegramMessage,
  update: TelegramUpdate,
) {
  const jobs = buildMediaJobs(message)

  if (jobs.length === 0) {
    await sendTelegramMessage(config.botToken || '', String(message.chat?.id || ''), 'No recibi medios. Usa /nuevo para iniciar un flujo guiado o envia una foto/video con descripcion.')
    return { status: 'ignored' as const, reason: 'no-media' }
  }

  const mediaAssets: MediaAssetRecord[] = []

  for (const job of jobs) {
    mediaAssets.push(await createMediaAssetFromTelegram(config.botToken || '', message, job))
  }

  const approval = config.autoCreateReviews
    ? await db.approvalItem.create({
        data: {
          source: 'telegram',
          entityType: 'incoming-media',
          status: 'pending',
          title: message.caption?.trim().split('\n')[0] || `Envio de Telegram (${mediaAssets.length} archivo(s))`,
          summary: `Ingreso rapido • ${mediaAssets.length} archivo(s)`,
          details: message.caption || 'Sin descripcion',
          requestedByType: 'telegram-user',
          requestedById: message.from?.id != null ? String(message.from.id) : null,
          payload: JSON.stringify({
            workflowType: 'quick-upload',
            caption: message.caption || '',
            chatId: message.chat?.id != null ? String(message.chat.id) : '',
            messageId: String(message.message_id),
            telegramUserId: message.from?.id != null ? String(message.from.id) : '',
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
    actorId: message.from?.id != null ? String(message.from.id) : null,
    entityType: 'approval',
    entityId: approval?.id || null,
    summary: 'Se recibio material desde Telegram',
    payload: {
      updateId: update.update_id,
      mediaAssetIds: mediaAssets.map((item) => item.id),
    },
  })

  await sendTelegramMessage(
    config.botToken || '',
    String(message.chat?.id || ''),
    approval
      ? 'Recibido. El material fue enviado a revision en el panel.'
      : 'Recibido. El material quedo almacenado.',
    mainMenuKeyboard(),
  )

  return {
    status: 'processed' as const,
    approvalId: approval?.id || null,
    mediaAssetIds: mediaAssets.map((item) => item.id),
  }
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

  if (!message?.chat?.id || !message.from?.id) {
    await createAutomationLog({
      source: 'telegram',
      eventType: 'update.ignored',
      status: 'ignored',
      summary: 'Update sin chat o usuario valido',
      payload: update,
    })
    return { status: 'ignored' as const, reason: 'no-message' }
  }

  const userId = String(message.from.id)
  const chatId = String(message.chat.id)
  const allowedUserIds = parseIdList(config.allowedUserIds)
  const allowedChatIds = parseIdList(config.allowedChatIds)
  const isAllowed = isAllowedValue(userId, allowedUserIds) && isAllowedValue(chatId, allowedChatIds)

  await storeTelegramIdentity(message.from, isAllowed)

  if (!isAllowed) {
    await createAutomationLog({
      source: 'telegram',
      eventType: 'message.rejected',
      status: 'rejected',
      actorType: 'telegram-user',
      actorId: userId,
      summary: 'Mensaje rechazado por listas de acceso',
      payload: { updateId: update.update_id, chatId },
    })

    return { status: 'rejected' as const, reason: 'not-allowed' }
  }

  const conversation = await getOrCreateConversation(userId, chatId)
  const normalizedText = normalizeText((message.text || message.caption || '').trim())
  const commandResult = await handleCommand(config, conversation, normalizedText)

  if (commandResult.handled) {
    return { status: 'handled' as const }
  }

  const refreshedConversation = await getOrCreateConversation(userId, chatId)
  const stepResult = await handleConversationStep(config, refreshedConversation, message)

  if (stepResult.handled) {
    return { status: 'handled' as const }
  }

  return processFastMediaMessage(config, message, update)
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
  const payload = parseStoredJson<Record<string, unknown>>(review.payload, {})
  const workflowType = String(payload.workflowType || '')
  let appliedEntity = { entityType: 'approval', entityId: review.id, summary: 'Revision aprobada' }

  if (workflowType === 'hero') {
    appliedEntity = await applyHeroApproval({
      heroSlot: payload.heroSlot as 'primary' | 'secondary' | undefined,
      heroDevice: payload.heroDevice as 'desktop' | 'mobile' | 'both' | undefined,
      mediaAssetIds: Array.isArray(payload.mediaAssetIds) ? (payload.mediaAssetIds as string[]) : [],
    })
  } else if (workflowType === 'project') {
    appliedEntity = await applyProjectApproval(config, {
      title: typeof payload.title === 'string' ? payload.title : '',
      category: typeof payload.category === 'string' ? payload.category : '',
      location: typeof payload.location === 'string' ? payload.location : '',
      year: typeof payload.year === 'string' ? payload.year : '',
      client: typeof payload.client === 'string' ? payload.client : '',
      description: typeof payload.description === 'string' ? payload.description : '',
      fullDescription: typeof payload.fullDescription === 'string' ? payload.fullDescription : '',
      showOnHomepage: Boolean(payload.showOnHomepage),
      mediaAssetIds: Array.isArray(payload.mediaAssetIds) ? (payload.mediaAssetIds as string[]) : [],
    })
  } else if (workflowType === 'project-media') {
    appliedEntity = await applyProjectMediaApproval({
      targetProjectId: typeof payload.targetProjectId === 'string' ? payload.targetProjectId : '',
      targetMediaRole: payload.targetMediaRole as 'primary' | 'mobile' | 'gallery' | 'video' | undefined,
      mediaAssetIds: Array.isArray(payload.mediaAssetIds) ? (payload.mediaAssetIds as string[]) : [],
    })
  } else {
    appliedEntity = await applyProjectApproval(config, {
      title: review.title,
      category: config.defaultProjectCategory || 'telegram',
      description: review.details || review.summary || 'Material recibido por Telegram.',
      fullDescription: review.details || review.summary || 'Material recibido por Telegram.',
      mediaAssetIds: Array.isArray(payload.mediaAssetIds) ? (payload.mediaAssetIds as string[]) : [],
    })
  }

  await db.approvalItem.update({
    where: { id: review.id },
    data: {
      status: 'approved',
      entityType: appliedEntity.entityType,
      entityId: appliedEntity.entityId,
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
    entityType: appliedEntity.entityType,
    entityId: appliedEntity.entityId,
    summary: appliedEntity.summary,
    payload: { reviewId: review.id },
  })

  return appliedEntity
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
    payload: { reason: reason || '' },
  })

  return updated
}
