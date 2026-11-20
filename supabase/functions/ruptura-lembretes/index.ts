// Edge Function "ruptura-lembretes" (Supabase). Chamada a cada minuto pelo agendador (pg_cron).
//
// - Lê as horas dos 3 turnos em ruptura_config (se a hora mudar na Gestão, o lembrete muda junto).
// - Na hora do turno (até 20 min depois, caso um minuto falhe), manda a notificação para todos os
//   aparelhos cadastrados, UMA vez por data+turno, e só se a checagem daquele turno ainda não foi feita.
// - "?teste=1" manda uma notificação de teste agora (no máximo uma por minuto).
//
// Segredo necessário (Edge Functions > Secrets): VAPID_PRIVATE_KEY
// Publicar com "Verify JWT" DESLIGADO (o agendador chama sem login; a função é segura sozinha).

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY = 'BGhBJ1qLKF7F5ZdI-4MwIApL0AFMeE8GGzHsnzbk6w8c7ta7x7xt9KxbzcDXyg3QCHZJp_v-xVjZhlJKAE0XAc0'
const JANELA_MINUTOS = 20
const URL_APP = '/?app=ruptura'

webpush.setVapidDetails('https://rdv-1.vercel.app', VAPID_PUBLIC_KEY, Deno.env.get('VAPID_PRIVATE_KEY') ?? '')

// Chave de serviço injetada pelo Supabase (o nome varia conforme o tipo de chave do projeto)
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
const sb = createClient(Deno.env.get('SUPABASE_URL')!, CHAVE_SERVICO)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** Data (aaaa-mm-dd) e minutos do dia agora, no fuso de Recife. */
function agoraRecife() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]))
  return { data: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) }
}

/** Igual a janelaDoLembrete em src/features/ruptura/lembreteJanela.js (mantenha as duas iguais). */
function naJanela(hora: string | null, agoraMin: number): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora ?? '')
  if (!m) return false
  const alvo = Number(m[1]) * 60 + Number(m[2])
  const diff = agoraMin - alvo
  return diff >= 0 && diff <= JANELA_MINUTOS
}

async function enviarParaTodos(payload: Record<string, string>) {
  const { data: aparelhos, error } = await sb.from('ruptura_push_aparelhos').select('endpoint,p256dh,auth')
  if (error) throw error
  let enviados = 0
  let removidos = 0
  const falhas: string[] = []
  await Promise.all(
    (aparelhos ?? []).map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          JSON.stringify(payload),
          { TTL: 1200, urgency: 'high' },
        )
        enviados++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          // aparelho que desinstalou o app ou revogou a permissão
          await sb.from('ruptura_push_aparelhos').delete().eq('endpoint', a.endpoint)
          removidos++
        } else {
          falhas.push(`${status ?? 'erro'}: ${(e as Error).message}`.slice(0, 120))
        }
      }
    }),
  )
  return { aparelhos: aparelhos?.length ?? 0, enviados, removidos, falhas }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = new URL(req.url)

    // ----- teste manual (botão na Gestão) -----
    if (url.searchParams.get('teste') === '1') {
      const { data: t } = await sb.from('ruptura_push_teste').select('ultimo').eq('id', 1).maybeSingle()
      if (t?.ultimo && Date.now() - new Date(t.ultimo).getTime() < 60_000) {
        return resposta({ erro: 'Aguarde 1 minuto entre testes.' }, 429)
      }
      await sb.from('ruptura_push_teste').upsert({ id: 1, ultimo: new Date().toISOString() })
      const r = await enviarParaTodos({
        titulo: 'Teste de lembrete',
        texto: 'Se você viu isso, os lembretes de ruptura estão funcionando neste aparelho.',
        tag: 'ruptura-teste',
        url: URL_APP,
      })
      return resposta({ teste: true, ...r })
    }

    // ----- lembretes dos turnos -----
    const { data: cfg, error: errCfg } = await sb.from('ruptura_config').select('*').eq('id', 1).maybeSingle()
    if (errCfg) throw errCfg
    if (!cfg) return resposta({ enviados: [] })

    const { data, minutos } = agoraRecife()
    const enviados: unknown[] = []

    for (const turno of [1, 2, 3]) {
      if (!naJanela(cfg[`hora${turno}`], minutos)) continue

      // checagem já feita neste turno: não precisa lembrar
      const { data: feita } = await sb.from('ruptura_checagens').select('id').eq('data', data).eq('turno', turno).maybeSingle()
      if (feita) continue

      // reserva o envio (só um chamador consegue; evita avisar duas vezes)
      const { data: reservado } = await sb
        .from('ruptura_push_envios')
        .upsert({ data, turno }, { onConflict: 'data,turno', ignoreDuplicates: true })
        .select()
      if (!reservado || reservado.length === 0) continue

      const nome = cfg[`nome${turno}`] as string
      const r = await enviarParaTodos({
        titulo: 'Hora da ruptura',
        texto: `Turno ${nome}: faça a checagem de ruptura.`,
        tag: `ruptura-turno-${turno}`,
        url: URL_APP,
      })
      enviados.push({ turno, nome, ...r })
    }

    return resposta({ data, enviados })
  } catch (e) {
    return resposta({ erro: (e as Error).message }, 500)
  }
})
