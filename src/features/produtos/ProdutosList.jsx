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
  const [precoEditado, setPrecoEditado] = useState('')

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
    setPrecoEditado(String(produto.preco_unitario))
  }

  async function salvarPreco(codigo) {
    const novoPreco = parseFloat(precoEditado.replace(',', '.'))
    if (Number.isNaN(novoPreco)) return
    await atualizarProduto(codigo, { preco_unitario: novoPreco })
    setProdutos((prev) =>
      prev.map((p) => (p.codigo === codigo ? { ...p, preco_unitario: novoPreco } : p))
    )
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
                <td>{p.nome}</td>
                <td>{p.unidade}</td>
                <td>
                  {editandoCodigo === p.codigo ? (
                    <input
                      style={{ width: 80 }}
                      value={precoEditado}
                      onChange={(e) => setPrecoEditado(e.target.value)}
                      autoFocus
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
                      <button onClick={() => salvarPreco(p.codigo)}>Salvar</button>
                      <button onClick={() => setEditandoCodigo(null)}>Cancelar</button>
                    </>
                  ) : (
                    <button onClick={() => iniciarEdicao(p)}>Editar preço</button>
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
