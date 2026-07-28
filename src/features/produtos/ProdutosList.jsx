import { useEffect, useState } from 'react'
import { buscarProdutos, atualizarProduto } from './produtosApi'
import { useDebounce } from '../../lib/useDebounce'

const TAMANHO_PAGINA = 50

export default function ProdutosList({ refreshKey }) {
  const [termo, setTermo] = useState('')
  const termoBuscado = useDebounce(termo, 300)
  const [pagina, setPagina] = useState(0)
  const [produtos, setProdutos] = useState([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const [editandoCodigo, setEditandoCodigo] = useState(null)
  const [edicao, setEdicao] = useState({ nome: '', unidade: 'UN', preco_unitario: '' })

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    buscarProdutos({ termo: termoBuscado, pagina, tamanhoPagina: TAMANHO_PAGINA })
      .then(({ data, count }) => {
        if (!ativo) return
        setProdutos(data)
        setTotal(count ?? 0)
      })
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [termoBuscado, pagina, refreshKey])

  function iniciarEdicao(produto) {
    setEditandoCodigo(produto.codigo)
    setEdicao({ nome: produto.nome, unidade: produto.unidade, preco_unitario: String(produto.preco_unitario) })
  }

  async function salvarEdicao(codigo) {
    const novoPreco = parseFloat(String(edicao.preco_unitario).replace(',', '.'))
    if (Number.isNaN(novoPreco) || edicao.nome.trim() === '') return
    const campos = { nome: edicao.nome.trim(), unidade: edicao.unidade, preco_unitario: novoPreco }
    await atualizarProduto(codigo, campos)
    setProdutos((prev) => prev.map((p) => (p.codigo === codigo ? { ...p, ...campos } : p)))
    setEditandoCodigo(null)
  }

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA))

  return (
    <div className="card">
      <h3>Produtos cadastrados ({total})</h3>
      <input
        type="text"
        placeholder="Buscar por nome ou código..."
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value)
          setPagina(0)
        }}
      />

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Unidade</th>
              <th>Preço</th>
              <th>Grupo</th>
              <th>Seção</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.codigo}>
                <td>{p.codigo}</td>
                <td>
                  {editandoCodigo === p.codigo ? (
                    <input
                      style={{ width: 200 }}
                      value={edicao.nome}
                      onChange={(e) => setEdicao((ed) => ({ ...ed, nome: e.target.value }))}
                      autoFocus
                    />
                  ) : (
                    p.nome
                  )}
                </td>
                <td>
                  {editandoCodigo === p.codigo ? (
                    <select
                      value={edicao.unidade}
                      onChange={(e) => setEdicao((ed) => ({ ...ed, unidade: e.target.value }))}
                    >
                      <option value="UN">UN</option>
                      <option value="KG">KG</option>
                      <option value="LT">LT</option>
                    </select>
                  ) : (
                    p.unidade
                  )}
                </td>
                <td>
                  {editandoCodigo === p.codigo ? (
                    <input
                      style={{ width: 80 }}
                      value={edicao.preco_unitario}
                      onChange={(e) => setEdicao((ed) => ({ ...ed, preco_unitario: e.target.value }))}
                    />
                  ) : (
                    p.preco_unitario.toFixed(2)
                  )}
                </td>
                <td>{p.grupo}</td>
                <td>{p.secao}</td>
                <td>
                  {editandoCodigo === p.codigo ? (
                    <>
                      <button onClick={() => salvarEdicao(p.codigo)}>Salvar</button>
                      <button onClick={() => setEditandoCodigo(null)}>Cancelar</button>
                    </>
                  ) : (
                    <button onClick={() => iniciarEdicao(p)}>Editar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="paginacao">
        <button disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
          Anterior
        </button>
        <span>
          Página {pagina + 1} de {totalPaginas}
        </span>
        <button disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
          Próxima
        </button>
      </div>
    </div>
  )
}
