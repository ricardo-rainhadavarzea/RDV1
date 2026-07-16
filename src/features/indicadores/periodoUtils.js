export const OPCOES_PERIODO = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: 'semana_atual', label: 'Semana atual' },
  { value: 'semana_passada', label: 'Semana passada' },
  { value: 'mes_atual', label: 'Mês atual' },
  { value: 'mes_passado', label: 'Mês passado' },
  { value: 'personalizado', label: 'Personalizado' },
]

/**
 * Converte pra Date local. Strings "YYYY-MM-DD" (do <input type="date">)
 * não podem ir direto pro construtor Date — o JS interpreta esse formato
 * como UTC, e o setHours(0,0,0,0) seguinte roda em horário local, o que
 * desalinha a data em até um dia dependendo do fuso do navegador.
 */
function paraDataLocal(date) {
  if (typeof date === 'string') {
    const [ano, mes, dia] = date.split('-').map(Number)
    return new Date(ano, mes - 1, dia)
  }
  return new Date(date)
}

function inicioDia(date) {
  const d = paraDataLocal(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function diaSeguinte(date) {
  const d = inicioDia(date)
  d.setDate(d.getDate() + 1)
  return d
}

/** Segunda-feira da semana da data informada, à meia-noite. */
export function segundaFeiraDe(date) {
  const d = inicioDia(date)
  const dia = d.getDay() // 0 = domingo
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  return d
}

function formatarISO(date) {
  const d = inicioDia(date)
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export { formatarISO }

/** Retorna { inicio, fim } como objetos Date. `fim` é exclusivo (início do dia seguinte ao último dia do período). */
export function calcularPeriodo(filtro, personalizado) {
  const hoje = new Date()

  switch (filtro) {
    case 'hoje':
      return { inicio: inicioDia(hoje), fim: diaSeguinte(hoje) }
    case 'ontem': {
      const ontem = new Date(hoje)
      ontem.setDate(ontem.getDate() - 1)
      return { inicio: inicioDia(ontem), fim: diaSeguinte(ontem) }
    }
    case 'semana_atual': {
      const inicio = segundaFeiraDe(hoje)
      const fim = new Date(inicio)
      fim.setDate(fim.getDate() + 7)
      return { inicio, fim }
    }
    case 'semana_passada': {
      const inicioAtual = segundaFeiraDe(hoje)
      const inicio = new Date(inicioAtual)
      inicio.setDate(inicio.getDate() - 7)
      return { inicio, fim: inicioAtual }
    }
    case 'mes_atual': {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
      return { inicio, fim }
    }
    case 'mes_passado': {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      return { inicio, fim }
    }
    case 'personalizado':
      return {
        inicio: inicioDia(personalizado.inicio),
        fim: diaSeguinte(personalizado.fim),
      }
    default:
      return { inicio: inicioDia(hoje), fim: diaSeguinte(hoje) }
  }
}

export function formatarDataBR(date) {
  const d = new Date(date)
  return d.toLocaleDateString('pt-BR')
}

/** Descrição legível do período pra exibir no relatório (tela e impressão). */
export function descreverPeriodo(filtro, inicio, fimExclusivo) {
  const ultimoDia = new Date(fimExclusivo)
  ultimoDia.setDate(ultimoDia.getDate() - 1)
  const label = OPCOES_PERIODO.find((o) => o.value === filtro)?.label ?? ''
  const intervalo =
    formatarDataBR(inicio) === formatarDataBR(ultimoDia)
      ? formatarDataBR(inicio)
      : `${formatarDataBR(inicio)} a ${formatarDataBR(ultimoDia)}`
  return `${label} (${intervalo})`
}
