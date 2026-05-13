export const EXTERNAL_CHAT_OPEN_EVENT = 'ssa:open-chat'

export type ChatLeadStage = 'discover' | 'qualified' | 'hot'

export type ExternalChatLeadContext = {
  source?: string
  stage?: ChatLeadStage
  projectType?: string
  serviceType?: string
  projectLocation?: string
  timeline?: string
  preferredContactChannel?: string
  contactConsent?: boolean
}

export type ExternalChatOpenDetail = {
  message?: string
  autoSend?: boolean
  leadContext?: ExternalChatLeadContext
}

export function dispatchExternalChatOpen(detail: ExternalChatOpenDetail) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<ExternalChatOpenDetail>(EXTERNAL_CHAT_OPEN_EVENT, {
      detail,
    }),
  )
}
