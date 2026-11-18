import { useEffect, useState } from 'react'
import { buscarConfig, salvarConfig } from './rupturaApi'

/** Nome (e hora opcional) dos três turnos da ruptura. */
export default function HorariosRuptura() {
  const [config, setConfig] = useState(null)
  const [msg, setMsg] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    buscarConfig().then(setConfig, () => setErro('Não consegui carregar os turnos.'))
  }, [])

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
    </form>
  )
}
