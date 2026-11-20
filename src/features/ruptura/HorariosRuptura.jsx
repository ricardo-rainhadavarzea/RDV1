import { useEffect, useState } from 'react'
import { enviarNotificacaoTeste } from './lembretes'
import { buscarConfig, salvarConfig } from './rupturaApi'

/** Nome (e hora opcional) dos três turnos da ruptura. */
export default function HorariosRuptura() {
  const [config, setConfig] = useState(null)
  const [msg, setMsg] = useState(null)
  const [erro, setErro] = useState(null)
  const [testando, setTestando] = useState(false)
  const [resultadoTeste, setResultadoTeste] = useState(null)

  useEffect(() => {
    buscarConfig().then(setConfig, () => setErro('Não consegui carregar os turnos.'))
  }, [])

  async function enviarTeste() {
    setResultadoTeste(null)
    setTestando(true)
    try {
      const r = await enviarNotificacaoTeste()
      setResultadoTeste({
        ok: r.enviados > 0,
        texto:
          r.aparelhos === 0
            ? 'Nenhum aparelho com lembretes ativados ainda. Peça para tocar em "Ativar lembretes" no app Ruptura.'
            : `Teste enviado para ${r.enviados} de ${r.aparelhos} aparelho(s).${r.removidos ? ` ${r.removidos} aparelho(s) antigo(s) removido(s).` : ''}${r.falhas?.length ? ` Falhas: ${r.falhas.join('; ')}` : ''}`,
      })
    } catch (e) {
      setResultadoTeste({ ok: false, texto: e.message })
    } finally {
      setTestando(false)
    }
  }

  if (!config) return <div className="card">{erro ? <p className="erro">{erro}</p> : 'Carregando…'}</div>

  function mudar(campo, i, valor) {
    const copia = [...config[campo]]
    copia[i] = valor
    setConfig({ ...config, [campo]: copia })
  }

  async function salvar(e) {
    e.preventDefault()
    setMsg(null)
    setErro(null)
    if (config.nomes.some((n) => !n.trim())) {
      setErro('Os três turnos precisam de um nome.')
      return
    }
    try {
      await salvarConfig({ nomes: config.nomes.map((n) => n.trim()), horas: config.horas })
      setMsg('Turnos salvos.')
    } catch (err) {
      setErro(err.message)
    }
  }

  return (
    <form className="card" onSubmit={salvar}>
      <h3>Turnos da ruptura</h3>
      <p className="campo-ajuda">Nome de cada checagem do dia e a hora (opcional). O histórico acompanha o nome novo.</p>
      {[0, 1, 2].map((i) => (
        <div className="rup-linha-form" key={i}>
          <div className="campo">
            <label>Nome do turno {i + 1}</label>
            <input value={config.nomes[i]} onChange={(e) => mudar('nomes', i, e.target.value)} />
          </div>
          <div className="campo">
            <label>Hora (opcional)</label>
            <input type="time" value={config.horas[i]} onChange={(e) => mudar('horas', i, e.target.value)} />
          </div>
        </div>
      ))}
      <button type="submit">Salvar turnos</button>
      {erro && <p className="erro">{erro}</p>}
      {msg && <p className="sucesso">{msg}</p>}

      <hr />
      <h3>Lembretes no celular</h3>
      <p className="campo-ajuda">
        Quem instalou o app Ruptura e tocou em &ldquo;Ativar lembretes&rdquo; recebe um aviso na hora de cada turno acima
        (só se a checagem daquele turno ainda não foi feita). Mudando a hora do turno, o lembrete muda junto. Turno sem
        hora não envia lembrete.
      </p>
      <button type="button" onClick={enviarTeste} disabled={testando}>
        {testando ? 'Enviando…' : 'Enviar notificação de teste agora'}
      </button>
      {resultadoTeste && <p className={resultadoTeste.ok ? 'sucesso' : 'erro'}>{resultadoTeste.texto}</p>}
    </form>
  )
}
