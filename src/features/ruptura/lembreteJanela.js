// Regra do lembrete: avisar na hora do turno, e ainda até JANELA_MINUTOS depois (caso uma
// chamada do agendador falhe). A mesma regra roda na Edge Function
// supabase/functions/ruptura-lembretes/index.ts (função `naJanela`): mantenha as duas iguais.

export const JANELA_MINUTOS = 20

/** `hora` no formato "HH:MM" (ou vazio = sem lembrete); `agoraMin` = minutos desde 00:00 em Recife. */
export function naJanela(hora, agoraMin) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora ?? '')
  if (!m) return false
  const alvo = Number(m[1]) * 60 + Number(m[2])
  const diff = agoraMin - alvo
  return diff >= 0 && diff <= JANELA_MINUTOS
}
