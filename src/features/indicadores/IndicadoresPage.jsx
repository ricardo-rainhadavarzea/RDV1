import { useEffect, useState } from 'react'
import PeriodoFiltro from './PeriodoFiltro'
import TotaisCards from './TotaisCards'
import GraficoSemanal from './GraficoSemanal'
import RankingPorSetor from './RankingPorSetor'
import SaldoBuffetPorSetor from './SaldoBuffetPorSetor'
import UsoInternoPorSetor from './UsoInternoPorSetor'
import { calcularPeriodo, formatarISO, descreverPeriodo } from './periodoUtils'
import {
  buscarTotaisPeriodo,
  buscarRankingPorSetor,
  buscarDesperdicioPorSemana,
  buscarSaldoBuffetPorSetor,
  buscarUsoInternoPorSetor,
} from './indicadoresApi'

const TOTAIS_VAZIOS = { desperdicio: 0, buffetIda: 0, buffetVolta: 0, saldoBuffet: 0, usoInterno: 0 }
const RANKING_VAZIO = { temVendasDoPeriodo: false, setores: [] }
const SALDO_BUFFET_VAZIO = { setores: [] }
const USO_INTERNO_VAZIO = { setores: [] }

export default function IndicadoresPage() {
  const [filtro, setFiltro] = useState('semana_atual')
  const [personalizado, setPersonalizado] = useState({
    inicio: formatarISO(new Date()),
    fim: formatarISO(new Date()),
  })

  const [totais, setTotais] = useState(TOTAIS_VAZIOS)
  const [ranking, setRanking] = useState(RANKING_VAZIO)
  const [saldoBuffet, setSaldoBuffet] = useState(SALDO_BUFFET_VAZIO)
  const [usoInterno, setUsoInterno] = useState(USO_INTERNO_VAZIO)
  const [semanas, setSemanas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false)
  const [detalhesCarregados, setDetalhesCarregados] = useState(false)
  const [erro, setErro] = useState(null)
  const [periodoTexto, setPeriodoTexto] = useState('')

  useEffect(() => {
    const { inicio, fim } = calcularPeriodo(filtro, personalizado)
    setPeriodoTexto(descreverPeriodo(filtro, inicio, fim))
    setCarregando(true)
    setErro(null)
    // Trocar de período invalida o ranking/saldo/uso interno já carregados —
    // em vez de recarregar tudo automaticamente (consultas pesadas), espera
    // o usuário clicar em "Carregar detalhes" de novo.
    setRanking(RANKING_VAZIO)
    setSaldoBuffet(SALDO_BUFFET_VAZIO)
    setUsoInterno(USO_INTERNO_VAZIO)
    setDetalhesCarregados(false)
    Promise.all([buscarTotaisPeriodo(inicio, fim), buscarDesperdicioPorSemana(8)])
      .then(([totaisRes, semanasRes]) => {
        setTotais(totaisRes)
        setSemanas(semanasRes)
      })
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false))
  }, [filtro, personalizado])

  function carregarDetalhes() {
    const { inicio, fim } = calcularPeriodo(filtro, personalizado)
    setCarregandoDetalhes(true)
    setErro(null)
    Promise.all([buscarRankingPorSetor(inicio, fim), buscarSaldoBuffetPorSetor(inicio, fim), buscarUsoInternoPorSetor(inicio, fim)])
      .then(([rankingRes, saldoBuffetRes, usoInternoRes]) => {
        setRanking(rankingRes)
        setSaldoBuffet(saldoBuffetRes)
        setUsoInterno(usoInternoRes)
        setDetalhesCarregados(true)
      })
      .catch((err) => setErro(err.message))
      .finally(() => setCarregandoDetalhes(false))
  }

  function imprimir(secao) {
    document.body.dataset.imprimir = secao
    window.print()
  }

  useEffect(() => {
    function limparModoImpressao() {
      delete document.body.dataset.imprimir
    }
    window.addEventListener('afterprint', limparModoImpressao)
    return () => window.removeEventListener('afterprint', limparModoImpressao)
  }, [])

  return (
    <div className="indicadores-page">
      <div className="cabecalho-impressao">
        <h2>Rainha da Várzea — Indicadores</h2>
        <p>
          Período: {periodoTexto} · Gerado em {new Date().toLocaleString('pt-BR')}
        </p>
      </div>

      <div className="no-imprimir">
        <PeriodoFiltro
          filtro={filtro}
          onFiltroChange={setFiltro}
          personalizado={personalizado}
          onPersonalizadoChange={setPersonalizado}
        />
        <div className="botoes-imprimir">
          <button onClick={carregarDetalhes} disabled={carregandoDetalhes}>
            {carregandoDetalhes ? 'Carregando detalhes...' : 'Carregar detalhes do período'}
          </button>
          <button className="botao-imprimir" onClick={() => imprimir('desperdicio')} disabled={!detalhesCarregados}>
            Imprimir Ranking de Desperdício
          </button>
          <button className="botao-imprimir" onClick={() => imprimir('buffet')} disabled={!detalhesCarregados}>
            Imprimir Saldo do Buffet
          </button>
          <button className="botao-imprimir" onClick={() => imprimir('uso_interno')} disabled={!detalhesCarregados}>
            Imprimir Uso Interno
          </button>
        </div>
      </div>

      {erro && <p className="erro">{erro}</p>}
      {carregando && <p>Carregando...</p>}

      {!carregando && (
        <>
          <div className="so-tela">
            <TotaisCards totais={totais} percentualGeral={ranking.percentualGeral} detalhesCarregados={detalhesCarregados} />
            <div className="card">
              <GraficoSemanal semanas={semanas} />
            </div>
          </div>
          {!detalhesCarregados && !carregandoDetalhes && (
            <p className="campo-ajuda">Escolha o período e clique em "Carregar detalhes do período" pra ver o ranking de desperdício, saldo do buffet e uso interno.</p>
          )}
          {detalhesCarregados && (
            <>
              <RankingPorSetor resultado={ranking} />
              <SaldoBuffetPorSetor resultado={saldoBuffet} />
              <UsoInternoPorSetor resultado={usoInterno} />
            </>
          )}
        </>
      )}
    </div>
  )
}
