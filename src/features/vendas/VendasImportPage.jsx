import { useEffect, useState } from 'react'
import { parseRelatorioVendas, importarVendas, listarPeriodosImportados } from './vendasApi'

function formatarData(iso) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function VendasImportPage() {
  const [arquivo, setArquivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [erro, setErro] = useState(null)
  const [progresso, setProgresso] = useState(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [periodosImportados, setPeriodosImportados] = useState([])

  useEffect(() => {
    carregarPeriodos()
  }, [])

  function carregarPeriodos() {
    listarPeriodosImportados()
      .then(setPeriodosImportados)
      .catch(() => {})
  }

  function handleArquivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setArquivo(file)
    setErro(null)
    setResultado(null)
    setPreview(null)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseRelatorioVendas(reader.result)
        setPreview(parsed)
      } catch (err) {
        setErro(err.message)
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleImportar() {
    if (!preview) return
    setImportando(true)
    setErro(null)
    try {
      const total = await importarVendas(preview.periodoInicio, preview.periodoFim, preview.linhas, (feitos, totalItens) =>
        setProgresso({ feitos, total: totalItens })
      )
      setResultado({ total, periodoInicio: preview.periodoInicio, periodoFim: preview.periodoFim })
      setPreview(null)
      setArquivo(null)
      carregarPeriodos()
    } catch (err) {
      setErro(err.message)
    } finally {
      setImportando(false)
      setProgresso(null)
    }
  }

  return (
    <div className="card">
      <h3>Importar vendas semanais (Curva ABC da BM)</h3>
      <p>Exporte o relatório da BM sempre de segunda a domingo e importe aqui.</p>

      <div className="campo">
        <label>Arquivo CSV</label>
        <input type="file" accept=".csv" onChange={handleArquivo} />
      </div>

      {erro && <p className="erro">{erro}</p>}

      {preview && !erro && (
        <div className="preview">
          <p>
            Período detectado: <strong>{formatarData(preview.periodoInicio)}</strong> a{' '}
            <strong>{formatarData(preview.periodoFim)}</strong> — {preview.linhas.length} produtos
          </p>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Produto</th>
                <th>Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {preview.linhas.slice(0, 5).map((l) => (
                <tr key={l.codigo}>
                  <td>{l.codigo}</td>
                  <td>{l.nome}</td>
                  <td>{l.quantidade}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={handleImportar} disabled={importando}>
            {importando ? 'Importando...' : 'Importar'}
          </button>

          {progresso && (
            <p>
              Processados {progresso.feitos} de {progresso.total}...
            </p>
          )}
        </div>
      )}

      {resultado && (
        <p className="sucesso">
          Importação concluída: {resultado.total} produtos ({formatarData(resultado.periodoInicio)} a{' '}
          {formatarData(resultado.periodoFim)}).
        </p>
      )}

      {periodosImportados.length > 0 && (
        <div className="periodos-importados">
          <h4>Períodos já importados</h4>
          <ul>
            {periodosImportados.map((p) => (
              <li key={p.periodoInicio + p.periodoFim}>
                {formatarData(p.periodoInicio)} a {formatarData(p.periodoFim)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
