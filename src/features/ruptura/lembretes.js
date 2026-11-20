import { supabase } from '../../lib/supabaseClient'

// Chave PÚBLICA do serviço de push (a privada fica só no Supabase, em Edge Functions > Secrets).
export const VAPID_PUBLIC_KEY =
  'BGhBJ1qLKF7F5ZdI-4MwIApL0AFMeE8GGzHsnzbk6w8c7ta7x7xt9KxbzcDXyg3QCHZJp_v-xVjZhlJKAE0XAc0'

function chaveParaBytes(base64Url) {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const bruto = atob(base64)
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0))
}

function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function instaladoNaTela() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

/**
 * 'nao_suportado' | 'ios_instalar' | 'bloqueado' | 'ativo' | 'inativo'
 * (iPhone só recebe push com o app instalado na tela inicial, iOS 16.4 ou mais novo.)
 */
export async function estadoLembretes() {
  const temApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!temApi) return ehIOS() && !instaladoNaTela() ? 'ios_instalar' : 'nao_suportado'
  if (Notification.permission === 'denied') return 'bloqueado'
  if (Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await registrar(sub) // mantém o cadastro em dia (idempotente)
      return 'ativo'
    }
  }
  return 'inativo'
}

async function registrar(sub) {
  const j = sub.toJSON()
  const { error } = await supabase.rpc('ruptura_push_registrar', {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys?.p256dh,
    p_auth: j.keys?.auth,
  })
  if (error) throw error
}

export async function ativarLembretes() {
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('permissao_negada')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(VAPID_PUBLIC_KEY) }))
  await registrar(sub)
}

export async function desativarLembretes() {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.rpc('ruptura_push_remover', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}

/** Gestão: pede à Edge Function uma notificação de teste para todos os aparelhos cadastrados. */
export async function enviarNotificacaoTeste() {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ruptura-lembretes?teste=1`
  const r = await fetch(url, { method: 'POST' })
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(corpo.erro || `Falha ao enviar o teste (${r.status}).`)
  return corpo // { aparelhos, enviados, removidos, falhas }
}
