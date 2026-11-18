import './ruptura.css'
import { useCallback, useEffect, useState } from 'react'
import {
  buscarConfig,
  enviarChecagem,
  ErroDuplicada,
  listarProdutosDaRuptura,
  turnosConcluidos,
} from './rupturaApi'
import { carregarRascunho, limparRascunho, salvarRascunho } from './rascunho'
import { formatData, hojeRecife, ordenarProdutos } from './rupturaLib'

const primeiroSemResposta = (respostas) => respostas.findIndex((x) => x === null)

/** Fluxo do operador: escolhe turno + nome, depois marca Sim/Não item a item. */
export default function RupturaPage({ onSair }) {
  const [rascunhoAtivo, setRascunhoAtivo] = useState(null)

  if (rascunhoAtivo) {
    return <Checagem rascunho={rascunhoAtivo.rascunho} turnoNome={rascunhoAtivo.turnoNome} onSair={onSair} />
  }
  return <Inicio onSair={onSair} onIniciar={(rascunho, turnoNome) => setRascunhoAtivo({ rascunho, turnoNome })} />
}

function Inicio({ onIniciar, onSair }) {
  const hoje = hojeRecife()
  const [config, setConfig] = useState(null)
  const [concluidos, setConcluidos] = useState([])
  const [erroCarga, setErroCarga] = useState(null)
  const [rascunho] = useState(carregarRascunho)
  const [turno, setTurno] = useState(rascunho?.turno ?? null)
  const [operador, setOperador] = useState(rascunho?.operador ?? '')
  const [iniciando, setIniciando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(async () => {
    setErroCarga(null)
    try {
      const [c, feitos] = await Promise.all([buscarConfig(), turnosConcluidos(hoje)])
      setConfig(c)
      setConcluidos(feitos)
    } catch {
      setErroCarga('Não consegui conectar. Confira a internet e tente de novo.')
    }
  }, [hoje])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Rascunho de um turno que já foi concluído por outro caminho não faz mais sentido.
  const rascunhoValido = rascunho && !concluidos.includes(rascunho.turno) ? rascunho : null
  useEffect(() => {
    if (rascunho && concluidos.includes(rascunho.turno)) limparRascunho()
  }, [rascunho, concluidos])

  const pronto = turno !== null && operador.trim().length > 0

  async function iniciar() {
    if (!pronto || !config) return
    setAviso(null)
    setIniciando(true)
    try {
      const feitos = await turnosConcluidos(hoje)
      setConcluidos(feitos)
      const nomeTurno = config.nomes[turno - 1]
      if (feitos.includes(turno)) {
        setAviso(`A checagem de ${nomeTurno} de hoje já foi concluída.`)
        return
      }
      if (rascunhoValido && rascunhoValido.turno === turno) {
        const r = { ...rascunhoValido, operador: operador.trim() }
        salvarRascunho(r)
        onIniciar(r, nomeTurno)
        return
      }
      if (
        rascunhoValido &&
        !window.confirm('Há uma checagem em andamento em outro turno. Começar esta e descartar a outra?')
      ) {
        return
      }
      const produtos = await listarProdutosDaRuptura()
      if (produtos.length === 0) {
        setAviso('Nenhum produto foi selecionado para a ruptura. Peça à Gestão para escolher em Gestão > Ruptura > Produtos.')
        return
      }
      const itens = ordenarProdutos(produtos)
      const r = {
        data: hoje,
        turno,
        operador: operador.trim(),
        clientId: crypto.randomUUID(),
        itens,
        respostas: itens.map(() => null),
      }
      salvarRascunho(r)
      onIniciar(r, nomeTurno)
    } catch {
      setAviso('Não consegui conectar. Confira a internet e tente de novo.')
    } finally {
      setIniciando(false)
    }
  }

  return (
    <div className="card rup-inicio">
      <div className="carrinho-header">
        <h2>Ruptura</h2>
        <button onClick={onSair}>Voltar</button>
      </div>

      {erroCarga ? (
        <>
          <p className="erro">{erroCarga}</p>
          <button onClick={carregar}>Tentar novamente</button>
        </>
      ) : !config ? (
        <p>Carregando…</p>
      ) : (
        <>
          <div className="campo">
            <label htmlFor="rup-data">Data</label>
            <input id="rup-data" type="date" value={hoje} min={hoje} max={hoje} onChange={() => {}} />
            <span className="campo-ajuda">{formatData(hoje)} — só é possível checar o dia de hoje.</span>
          </div>

          <div className="campo">
            <label>Turno</label>
            <div className="rup-turnos">
              {config.nomes.map((nome, i) => {
                const n = i + 1
                const feito = concluidos.includes(n)
                const emAndamento = rascunhoValido?.turno === n
                return (
                  <button
                    key={n}
                    className={'rup-turno' + (turno === n ? ' rup-turno-ativo' : '')}
                    disabled={feito}
                    aria-pressed={turno === n}
                    onClick={() => {
                      setTurno(n)
                      if (rascunhoValido?.turno === n) setOperador(rascunhoValido.operador)
                    }}
                  >
                    <strong>{nome}</strong>
                    {config.horas[i] && <span>{config.horas[i]}</span>}
                    {feito && <span className="rup-selo rup-selo-ok">Concluído</span>}
                    {!feito && emAndamento && <span className="rup-selo">Continuar</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="campo">
            <label htmlFor="rup-operador">Nome de quem vai fazer</label>
            <input
              id="rup-operador"
              type="text"
              value={operador}
              onChange={(e) => setOperador(e.target.value)}
              placeholder="Seu nome"
              autoComplete="off"
            />
          </div>

          {aviso && <p className="erro">{aviso}</p>}

          <button className="rup-iniciar" disabled={!pronto || iniciando} onClick={iniciar}>
            {iniciando ? 'Aguarde…' : 'RUPTURA'}
          </button>
        </>
      )}
    </div>
  )
}

function Checagem({ rascunho, turnoNome, onSair }) {
  const [r, setR] = useState(rascunho)
  const [cursor, setCursor] = useState(() => Math.max(primeiroSemResposta(rascunho.respostas), 0))
  // 'perguntando' | 'enviando' | 'erro' | 'duplicada' | 'concluida'
  const [fase, setFase] = useState(() => (primeiroSemResposta(rascunho.respostas) === -1 ? 'erro' : 'perguntando'))

  const total = r.itens.length
  const preenchidos = r.respostas.filter((x) => x !== null).length
  const item = r.itens[cursor]
  const respostaAtual = r.respostas[cursor]

  async function enviar(atual) {
    setFase('enviando')
    try {
      await enviarChecagem(atual)
      // 'ok' e 'ja_concluida' (confirmação perdida num envio anterior) contam como concluído
      limparRascunho()
      setFase('concluida')
    } catch (e) {
      if (e instanceof ErroDuplicada) {
        limparRascunho()
        setFase('duplicada')
      } else {
        setFase('erro') // respostas continuam salvas; só aqui o reenvio é permitido
      }
    }
  }

  function responder(valor) {
    if (fase !== 'perguntando') return
    navigator.vibrate?.(30)
    const respostas = [...r.respostas]
    respostas[cursor] = valor
    const novo = { ...r, respostas }
    setR(novo)
    salvarRascunho(novo)
    const prox = primeiroSemResposta(respostas)
    if (prox === -1) enviar(novo)
    else setCursor(prox)
  }

  if (fase === 'concluida') {
    return (
      <div className="card rup-final">
        <div className="rup-check-grande" aria-hidden="true">✓</div>
        <h2>Ruptura concluída</h2>
        <p>Obrigado, {r.operador}!</p>
        <button className="rup-iniciar" onClick={onSair}>
          Voltar ao início
        </button>
      </div>
    )
  }

  if (fase === 'duplicada') {
    return (
      <div className="card rup-final">
        <h2>Checagem já concluída</h2>
        <p>Já existe uma checagem de {turnoNome} para hoje. Não é possível enviar outra.</p>
        <button className="rup-iniciar" onClick={onSair}>
          Voltar ao início
        </button>
      </div>
    )
  }

  if (fase === 'enviando' || fase === 'erro') {
    return (
      <div className="card rup-final">
        {fase === 'enviando' ? (
          <>
            <h2>Enviando…</h2>
            <p>Não feche o aplicativo.</p>
          </>
        ) : (
          <>
            <h2>Não consegui enviar</h2>
            <p className="erro">Parece que a internet falhou. Suas {total} respostas estão guardadas neste aparelho.</p>
            <button className="rup-iniciar" onClick={() => enviar(r)}>
              Tentar novamente
            </button>
            <button onClick={onSair}>Sair e continuar depois</button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="card rup-checagem">
      <div className="carrinho-header">
        <button onClick={cursor > 0 ? () => setCursor(cursor - 1) : onSair}>
          {cursor > 0 ? '← Voltar' : '← Sair'}
        </button>
        <span>{turnoNome}</span>
      </div>

      <div className="rup-barra" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={preenchidos}>
        <div style={{ width: `${(preenchidos / total) * 100}%` }} />
      </div>
      <p className="rup-progresso">
        {preenchidos} {preenchidos === 1 ? 'item preenchido' : 'itens preenchidos'}, faltam {total - preenchidos}
      </p>

      <div className="rup-pergunta">
        <p className="rup-setor">{item.secao}</p>
        <h2 className="rup-produto">{item.nome}</h2>
        <p>Ele está disponível?</p>
      </div>

      <div className="rup-respostas">
        <button className={'rup-resp rup-sim' + (respostaAtual === true ? ' rup-marcada' : '')} onClick={() => responder(true)}>
          Sim
        </button>
        <button className={'rup-resp rup-nao' + (respostaAtual === false ? ' rup-marcada' : '')} onClick={() => responder(false)}>
          Não
        </button>
      </div>
    </div>
  )
}
