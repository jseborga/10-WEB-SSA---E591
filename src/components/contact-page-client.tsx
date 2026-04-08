'use client'

import { FormEvent, useMemo, useState } from 'react'
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/language-context'
import { PublicPublication, PublicSiteSettings, getLocalizedPublicationValue } from '@/lib/public-site'
import { SiteHeader } from '@/components/site-header'

interface ContactPageClientProps {
  siteSettings?: PublicSiteSettings
  publication?: PublicPublication | null
}

function normalizePhoneLink(value: string) {
  return value.replace(/[^\d+]/g, '')
}

function normalizeWhatsappLink(value: string) {
  return value.replace(/\D/g, '')
}

export function ContactPageClient({ siteSettings, publication }: ContactPageClientProps) {
  const { t, language } = useLanguage()
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  })
  const [sending, setSending] = useState(false)

  const contactCopy = useMemo(() => {
    if (language === 'en') {
      return {
        title: 'Contact',
        intro: 'Tell us about your project and we will get back to you shortly.',
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        subject: 'Subject',
        message: 'Message',
        send: 'Send message',
        success: 'Message sent successfully',
        error: 'Could not send the message',
      }
    }

    if (language === 'pt') {
      return {
        title: 'Contato',
        intro: 'Conte-nos sobre seu projeto e responderemos em breve.',
        name: 'Nome',
        email: 'Email',
        phone: 'Telefone',
        subject: 'Assunto',
        message: 'Mensagem',
        send: 'Enviar mensagem',
        success: 'Mensagem enviada com sucesso',
        error: 'Nao foi possivel enviar a mensagem',
      }
    }

    return {
      title: 'Contacto',
      intro: 'Cuéntanos sobre tu proyecto y te responderemos a la brevedad.',
      name: 'Nombre',
      email: 'Correo',
      phone: 'Telefono',
      subject: 'Asunto',
      message: 'Mensaje',
      send: 'Enviar mensaje',
      success: 'Mensaje enviado correctamente',
      error: 'No se pudo enviar el mensaje',
    }
  }, [language])

  const title = getLocalizedPublicationValue(publication, language, 'title') || contactCopy.title
  const excerpt = getLocalizedPublicationValue(publication, language, 'excerpt') || contactCopy.intro
  const body = getLocalizedPublicationValue(publication, language, 'content')
  const socialLinks = [
    { label: 'Instagram', href: siteSettings?.instagramUrl?.trim() || '', icon: Instagram },
    { label: 'Facebook', href: siteSettings?.facebookUrl?.trim() || '', icon: Facebook },
    { label: 'LinkedIn', href: siteSettings?.linkedinUrl?.trim() || '', icon: Linkedin },
  ].filter((item) => item.href)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      })

      if (!response.ok) {
        throw new Error('request_failed')
      }

      setFormState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
      })
      toast.success(contactCopy.success)
    } catch {
      toast.error(contactCopy.error)
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader tone="dark" logoUrl={siteSettings?.logoUrl} companyName={siteSettings?.companyName} />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t.nav.contact || 'Contacto'}</p>
            <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-zinc-600">{excerpt}</p>
            {body ? <p className="mt-6 text-sm leading-7 text-zinc-500">{body}</p> : null}

            <div className="mt-10 space-y-5">
              {siteSettings?.email ? (
                <a href={`mailto:${siteSettings.email}`} className="flex items-center gap-3 text-sm text-zinc-700 transition-colors hover:text-zinc-900">
                  <Mail className="h-4 w-4 text-zinc-400" />
                  <span>{siteSettings.email}</span>
                </a>
              ) : null}
              {siteSettings?.phone ? (
                <a href={`tel:${normalizePhoneLink(siteSettings.phone)}`} className="flex items-center gap-3 text-sm text-zinc-700 transition-colors hover:text-zinc-900">
                  <Phone className="h-4 w-4 text-zinc-400" />
                  <span>{siteSettings.phone}</span>
                </a>
              ) : null}
              {siteSettings?.whatsapp ? (
                <a
                  href={`https://wa.me/${normalizeWhatsappLink(siteSettings.whatsapp)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 text-sm text-zinc-700 transition-colors hover:text-zinc-900"
                >
                  <Phone className="h-4 w-4 text-zinc-400" />
                  <span>WhatsApp {siteSettings.whatsapp}</span>
                </a>
              ) : null}
              {[siteSettings?.addressLine, siteSettings?.city, siteSettings?.country].filter(Boolean).length > 0 ? (
                <div className="flex items-start gap-3 text-sm text-zinc-700">
                  <MapPin className="mt-0.5 h-4 w-4 text-zinc-400" />
                  <span>{[siteSettings?.addressLine, siteSettings?.city, siteSettings?.country].filter(Boolean).join(', ')}</span>
                </div>
              ) : null}
            </div>

            {socialLinks.length > 0 ? (
              <div className="mt-8 flex items-center gap-3">
                {socialLinks.map((social) => {
                  const Icon = social.icon

                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900"
                      aria-label={social.label}
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  )
                })}
              </div>
            ) : null}
          </div>

          <div className="rounded-[32px] border border-zinc-200 p-6 sm:p-8">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{contactCopy.name}</span>
                  <input
                    required
                    value={formState.name}
                    onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  />
                </label>
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{contactCopy.email}</span>
                  <input
                    required
                    type="email"
                    value={formState.email}
                    onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{contactCopy.phone}</span>
                  <input
                    value={formState.phone}
                    onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  />
                </label>
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{contactCopy.subject}</span>
                  <input
                    value={formState.subject}
                    onChange={(event) => setFormState((current) => ({ ...current, subject: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm text-zinc-600">
                <span>{contactCopy.message}</span>
                <textarea
                  required
                  rows={7}
                  value={formState.message}
                  onChange={(event) => setFormState((current) => ({ ...current, message: event.target.value }))}
                  className="w-full rounded-[24px] border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                />
              </label>

              <button
                type="submit"
                disabled={sending}
                className="inline-flex rounded-full bg-zinc-900 px-6 py-3 text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {sending ? '...' : contactCopy.send}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}
