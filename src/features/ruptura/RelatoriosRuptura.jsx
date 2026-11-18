import { useEffect, useState } from 'react'
import { buscarConfig, buscarLinhas } from './rupturaApi'
import { exportarExcel } from './exportarExcelRuptura'
import {
  addDias,
  comparativo,
  formatData,
  formatDataCurta,
  formatPct,
  formatPP,
  hojeRecife,
  periodoAnterior,
  porDia,
  porProduto,
  porSetor,
  porTurno,
  resumo,
  totalGeral,
} from './rupturaLib'

const BLOCOS = [
  { id: 'resumo', nome: 'Resumo' },
  { id: 'dia', nome: 'Por dia' },
  { id: 'turno', nome: 'Por turno' },
  { id: 'setor', nome: 'Por setor' },
  { id: 'produto', nome: 'Por produto' },
  { id: 'comparativo', nome: 'Comparativo' },
]

export default function RelatoriosRuptura() {
  const hoje = hojeRecife()
  const [ini, setIni] = useState(addDias(hoje, -6))
  const [fim, setFim] = useState(hoje)
  const [dados, setDados] = useState(null)
  const [bloco, setBloco] = useState('resumo')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  async function gerar() {
    setErro(null)
    if (!ini || !fim || ini > fim) {
      setErro('Escolha um intervalo válido (data inicial até a data final).')
      return
    }
    setCarregando(true)
    try {
      const ant = periodoAnterior(ini, fim)
      const [config, atual, anterior] = await Promise.all([
        buscarConfig(),
        buscarLinhas(ini, fim),
        buscarLinhas(ant.ini, ant.fim),
      ])
      setDados({ ini, fim, config, atual, anterior })
    } catch (e) {
      setErro(`Não consegui carregar os dados: ${e.message}`)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    gerar()
  }, [])

  return (
    <div className="card">
      <h3>Relatórios de ruptura</h3>
      <div className="rup-filtro">
        <label>
          De
          <input type="date" value={ini} max={fim} onChange={(e) => setIni(e.target.value)} />
        </label>
        <label>
          Até
          <input type="date" value={fim} min={ini} onChange={(e) => setFim(e.target.value)} />
        </label>
        <button onClick={gerar} disabled={carregando}>
          {carregando ? 'Carregando…' : 'Ver relatório'}
        </button>
        <button onClick={() => dados && exportarExcel(dados)} disabled={!dados || carregando}>
          Exportar Excel
        </button>
      </div>
      {erro && <p className="erro">{erro}</p>}
      {dados && <Conteudo dados={dados} bloco={bloco} setBloco={setBloco} />}
    </div>
  )
}

function Conteudo({ dados, bloco, setBloco }) {
  const { atual, anterior, config, ini, fim } = dados
  const geral = totalGeral(atual)
  return (
    <>
      <p>
        {formatData(ini)} a {formatData(fim)} · <strong>{geral.checados}</strong> itens checados ·{' '}
        <strong>{geral.indisp}</strong> indisponíveis · índice <strong>{formatPct(geral.indice)}</strong>
      </p>
      <nav className="abas-gestao">
        {BLOCOS.map((b) => (
          <button key={b.id} className={bloco === b.id ? 'aba-ativa' : ''} onClick={() => setBloco(b.id)}>
            {b.nome}
          </button>
        ))}
      </nav>

      {atual.length === 0 && bloco !== 'comparativo' ? (
        <p>Nenhuma checagem neste intervalo.</p>
      ) : (
        <>
          {bloco === 'resumo' && <TabelaResumo linhas={atual} ini={ini} fim={fim} nomes={config.nomes} />}
          {bloco === 'dia' && <TabelaIndice titulo="Data" linhas={porDia(atual)} formatarChave={formatData} />}
          {bloco === 'turno' && <TabelaIndice titulo="Turno" linhas={porTurno(atual, config.nomes)} />}
          {bloco === 'setor' && <TabelaIndice titulo="Setor" linhas={porSetor(atual)} />}
          {bloco === 'produto' && <TabelaProdutos linhas={atual} />}
          {bloco === 'comparativo' && <TabelaComparativo atual={atual} anterior={anterior} ini={ini} fim={fim} />}
        </>
      )}
    </>
  )
}

function TabelaIndice({ titulo, linhas, formatarChave }) {
  return (
    <div className="rup-rolagem">
      <table>
        <thead>
          <tr>
            <th>{titulo}</th>
            <th className="rup-num">Itens checados</th>
            <th className="rup-num">Indisponíveis</th>
            <th className="rup-num">Índice de ruptura</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave}>
              <td>{formatarChave ? formatarChave(l.chave) : l.chave}</td>
              <td className="rup-num">{l.checados}</td>
              <td className="rup-num">{l.indisp}</td>
              <td className="rup-num rup-forte">{formatPct(l.indice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabelaProdutos({ linhas }) {
  return (
    <div className="rup-rolagem">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Produto</th>
            <th>Setor</th>
            <th className="rup-num">Itens checados</th>
            <th className="rup-num">Indisponíveis</th>
            <th className="rup-num">Índice de ruptura</th>
          </tr>
        </thead>
        <tbody>
          {porProduto(linhas).map((p) => (
            <tr key={p.codigo}>
              <td>{p.codigo}</td>
              <td>{p.produto}</td>
              <td>{p.setor}</td>
              <td className="rup-num">{p.checados}</td>
              <td className="rup-num">{p.indisp}</td>
              <td className="rup-num rup-forte">{formatPct(p.indice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabelaResumo({ linhas, ini, fim, nomes }) {
  const r = resumo(linhas, ini, fim)
  return (
    <div className="rup-rolagem rup-matriz-wrap">
      <table className="rup-matriz">
        <thead>
          <tr>
            <th rowSpan={2} className="rup-col-produto">
              Produto
            </th>
            {r.datas.map((d, i) => (
              <th key={d} colSpan={3} className={i % 2 ? 'rup-dia-b' : 'rup-dia-a'}>
                {formatDataCurta(d)}
              </th>
            ))}
          </tr>
          <tr>
            {r.datas.flatMap((d, i) =>
              nomes.map((n, t) => (
                <th key={d + t} className={i % 2 ? 'rup-dia-b' : 'rup-dia-a'}>
                  {n}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {r.grupos.map((g) => (
            <GrupoLinhas key={g.setor} g={g} r={r} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GrupoLinhas({ g, r }) {
  return (
    <>
      <tr className="rup-titulo-setor">
        <th colSpan={1 + r.datas.length * 3} scope="colgroup">
          {g.setor}
        </th>
      </tr>
      {g.produtos.map((p) => (
        <tr key={p.codigo}>
          <th className="rup-col-produto" scope="row">
            {p.nome}
          </th>
          {r.datas.flatMap((d, i) =>
            [1, 2, 3].map((turno) => {
              const v = r.celula(p.codigo, d, turno)
              return (
                <td
                  key={d + turno}
                  className={(i % 2 ? 'rup-dia-b ' : 'rup-dia-a ') + (v === undefined ? '' : v ? 'rup-celula-sim' : 'rup-celula-nao')}
                >
                  {v === undefined ? '' : v ? 'Sim' : 'Não'}
                </td>
              )
            })
          )}
        </tr>
      ))}
    </>
  )
}

function TabelaComparativo({ atual, anterior, ini, fim }) {
  const ant = periodoAnterior(ini, fim)
  const itens = comparativo(atual, anterior)
  return (
    <>
      <p>
        Período escolhido ({formatData(ini)} a {formatData(fim)}) contra o período anterior de mesma duração (
        {formatData(ant.ini)} a {formatData(ant.fim)}).
      </p>
      <div className="rup-rolagem">
        <table>
          <thead>
            <tr>
              <th></th>
              <th className="rup-num">Checados</th>
              <th className="rup-num">Indisp.</th>
              <th className="rup-num">Índice atual</th>
              <th className="rup-num">Checados (ant.)</th>
              <th className="rup-num">Indisp. (ant.)</th>
              <th className="rup-num">Índice anterior</th>
              <th className="rup-num">Variação</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.chave} className={i.chave === 'Geral' ? 'rup-destaque' : ''}>
                <td>{i.chave}</td>
                <td className="rup-num">{i.atual.checados}</td>
                <td className="rup-num">{i.atual.indisp}</td>
                <td className="rup-num rup-forte">{formatPct(i.atual.indice)}</td>
                <td className="rup-num">{i.anterior.checados}</td>
                <td className="rup-num">{i.anterior.indisp}</td>
                <td className="rup-num rup-forte">{formatPct(i.anterior.indice)}</td>
                <td className={'rup-num rup-forte ' + (i.variacao === null ? '' : i.variacao > 0 ? 'rup-pior' : i.variacao < 0 ? 'rup-melhor' : '')}>
                  {formatPP(i.variacao)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
