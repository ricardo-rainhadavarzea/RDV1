import { useState } from 'react'
import Papa from 'papaparse'
import { mapHeaders, rowsToProdutos, importarProdutos } from './produtosApi'

const CAMPOS_OBRIGATORIOS = ['codigo', 'nome', 'unidade', 'preco_unitario']

export default function ProdutosImport({ onImportado }) {
  const [arquivo, setArquivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [erro, setErro] = useState(null)
  const [modo, setModo] = useState('incremental')
  const [progresso, setProgresso] = useState(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)

  function handleArquivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setArquivo(file)
    setErro(null)
    setResultado(null)
    setPreview(null)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 6,
      complete: (results) => {
        const headers = results.meta.fields ?? []
        const headerMap = mapHeaders(headers)
        const faltando = CAMPOS_OBRIGATORIOS.filter((c) => !headerMap[c])
        if (faltando.length > 0) {
          setErro(
            `Não consegui identificar as colunas: ${faltando.join(', ')}. Cabeçalhos encontrados no arquivo: ${headers.join(', ')}`
          )
          return
        }
        setPreview({ headers, headerMap, amostra: rowsToProdutos(results.data, headerMap) })
      },
      error: (err) => setErro(err.message),
    })
  }

  function handleImportar() {
    if (!arquivo || !preview) return
    setImportando(true)
    setErro(null)
    setResultado(null)

    Papa.parse(arquivo, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const produtos = rowsToProdutos(results.data, preview.headerMap)
          const total = await importarProdutos(produtos, modo, (feitos, totalItens) =>
            setProgresso({ feitos, total: totalItens })
          )
          setResultado({ total, modo })
          onImportado?.()
        } catch (err) {
          setErro(err.message)
        } finally {
          setImportando(false)
          setProgresso(null)
        }
      },
      error: (err) => {
        setErro(err.message)
        setImportando(false)
      },
    })
  }

  return (
    <div className="card">
      <h3>Importar cadastro de produtos (CSV)</h3>

      <div className="campo">
        <label>Arquivo CSV</label>
        <input type="file" accept=".csv" onChange={handleArquivo} />
      </div>

      <div className="campo">
        <label>Modo de importação</label>
        <div className="opcoes-modo">
          <label>
            <input
              type="radio"
              name="modo"
              value="incremental"
              checked={modo === 'incremental'}
              onChange={() => setModo('incremental')}
            />
            Atualização incremental (atualiza existentes, adiciona novos)
          </label>
          <label>
            <input
              type="radio"
              name="modo"
              value="massa"
              checked={modo === 'massa'}
              onChange={() => setModo('massa')}
            />
            Importação em massa (apaga tudo e recadastra do zero)
          </label>
        </div>
      </div>

      {erro && <p className="erro">{erro}</p>}

      {preview && !erro && (
        <div className="preview">
          <p>
            Colunas identificadas: código → <code>{preview.headerMap.codigo}</code>, nome → <code>{preview.headerMap.nome}</code>,
            unidade → <code>{preview.headerMap.unidade}</code>, preço → <code>{preview.headerMap.preco_unitario}</code>
            {preview.headerMap.grupo && <> , grupo → <code>{preview.headerMap.grupo}</code></>}
            {preview.headerMap.secao && <> , seção → <code>{preview.headerMap.secao}</code></>}
          </p>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Unidade</th>
                <th>Preço</th>
                <th>Grupo</th>
                <th>Seção</th>
              </tr>
            </thead>
            <tbody>
              {preview.amostra.slice(0, 5).map((p) => (
                <tr key={p.codigo}>
                  <td>{p.codigo}</td>
                  <td>{p.nome}</td>
                  <td>{p.unidade}</td>
                  <td>{p.preco_unitario.toFixed(2)}</td>
                  <td>{p.grupo}</td>
                  <td>{p.secao}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={handleImportar} disabled={importando}>
            {importando ? 'Importando...' : modo === 'massa' ? 'Apagar tudo e importar' : 'Importar / atualizar'}
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
          Importação concluída ({resultado.modo}): {resultado.total} produtos processados.
        </p>
      )}
    </div>
  )
}
