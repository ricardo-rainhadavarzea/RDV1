import { useEffect, useState } from 'react'
import PeriodoFiltro from './PeriodoFiltro'
import TotaisCards from './TotaisCards'
import GraficoSemanal from './GraficoSemanal'
import RankingPorSetor from './RankingPorSetor'
import SaldoBuffetPorSetor from './SaldoBuffetPorSetor'
import { calcularPeriodo, formatarISO } from './periodoUtils'
import {
  buscarTotaisPeriodo,
  buscarRankingPorSetor,
  buscarDesperdicioPorSemana,
  buscarSaldoBuffetPorSetor,
} from './indicadoresApi'

const TOTAIS_VAZIOS = { desperdicio: 0, buffetIda: 0, buffetVolta: 0, saldoBuffet: 0, usoInterno: 0 }
const RANKING_VAZIO = { temVendasDoPeriodo: false, setores: [] }
const SALDO_BUFFET_VAZIO = { setores: [] }

export default function IndicadoresPage() {
  const [filtro, setFiltro] = useState('semana_atual')
  const [personalizado, setPersonalizado] = useState({
    inicio: formatarISO(new Date()),
    fim: formatarISO(new Date()),
  })

  const [totais, setTotais] = useState(TOTAIS_VAZIOS)
  const [ranking, setRanking] = useState(RANKING_VAZIO)
  const [saldoBuffet, setSaldoBuffet] = useState(SALDO_BUFFET_VAZIO)
  const [semanas, setSemanas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    const { inicio, fim } = calcularPeriodo(filtro, personalizado)
    setCarregando(true)
    setErro(null)
    Promise.all([
      buscarTotaisPeriodo(inicio, fim),
      buscarRankingPorSetor(inicio, fim),
      buscarDesperdicioPorSemana(8),
      buscarSaldoBuffetPorSetor(inicio, fim),
    ])
      .then(([totaisRes, rankingRes, semanasRes, saldoBuffetRes]) => {
        setTotais(totaisRes)
        setRanking(rankingRes)
        setSemanas(semanasRes)
        setSaldoBuffet(saldoBuffetRes)
      })
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false))
  }, [filtro, personalizado])

  return (
    <div className="indicadores-page">
      <PeriodoFiltro
        filtro={filtro}
        onFiltroChange={setFiltro}
        personalizado={personalizado}
        onPersonalizadoChange={setPersonalizado}
      />

      {erro && <p className="erro">{erro}</p>}
      {carregando && <p>Carregando...</p>}

      {!carregando && (
        <>
          <TotaisCards totais={totais} />
          <div className="card">
            <GraficoSemanal semanas={semanas} />
          </div>
          <RankingPorSetor resultado={ranking} />
          <SaldoBuffetPorSetor resultado={saldoBuffet} />
        </>
      )}
    </div>
  )
}
