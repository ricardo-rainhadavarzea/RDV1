import { useState } from 'react'
import TipoSelector from './TipoSelector'
import ScannerInput from './ScannerInput'
import BuscaManual from './BuscaManual'
import CarrinhoList from './CarrinhoList'
import { decodeEtiqueta } from './decodeEtiqueta'
import { buscarProdutoPorCodigo, salvarMovimentacao, TIPOS } from './lancamentoApi'

export default function CarrinhoPage() {
  const [tipo, setTipo] = useState(null)
  const [itens, setItens] = useState([])
  const [mensagem, setMensagem] = useState(null)
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const tipoLabel = TIPOS.find((t) => t.value === tipo)?.label

  function adicionarItem(item) {
    setItens((prev) => [item, ...prev])
  }

  function removerItem(index) {
    setItens((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleCodigoCompleto(digits) {
    setErro(null)
    setMensagem(null)

    const decodificado = decodeEtiqueta(digits)
    if (!decodificado) {
      setErro(`Etiqueta não reconhecida (${digits}).`)
      return
    }

    let produto
    try {
      produto = await buscarProdutoPorCodigo(decodificado.codigoProduto)
    } catch (err) {
      setErro(err.message)
      return
    }

    if (!produto) {
      setErro(`Produto não encontrado (código ${decodificado.codigoProduto}).`)
      return
    }

    if (!produto.preco_unitario || produto.preco_unitario <= 0) {
      setErro(
        `"${produto.nome}" não tem preço cadastrado — não dá pra calcular a quantidade automaticamente. Cadastre um preço em Gestão > Produtos.`
      )
      return
    }

    const quantidade = decodificado.valor / produto.preco_unitario
    adicionarItem({
      codigo: produto.codigo,
      nome: produto.nome,
      unidade: produto.unidade,
      quantidade,
      valor: decodificado.valor,
      origem: 'bipagem',
    })
    setMensagem(`Adicionado: ${produto.nome} — ${quantidade.toFixed(3)} ${produto.unidade}`)
  }

  function trocarTipo() {
    if (itens.length > 0) {
      const confirmar = window.confirm(
        'Você tem itens não confirmados nesse carrinho. Trocar de tipo vai descartar esses itens. Continuar?'
      )
      if (!confirmar) return
    }
    setTipo(null)
    setItens([])
    setErro(null)
    setMensagem(null)
  }

  async function confirmarLancamento() {
    if (itens.length === 0) return
    setSalvando(true)
    setErro(null)
    try {
      await salvarMovimentacao(tipo, itens)
      setItens([])
      setMensagem(`Lançamento confirmado (${tipoLabel}).`)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  if (!tipo) {
    return <TipoSelector onSelecionar={setTipo} />
  }

  return (
    <div className="carrinho-page">
      <div className="card carrinho-header">
        <h2>{tipoLabel}</h2>
        <button onClick={trocarTipo}>Trocar tipo</button>
      </div>

      <div className="card">
        <ScannerInput onCodigoCompleto={handleCodigoCompleto} desabilitado={salvando} />
        {mensagem && <p className="sucesso">{mensagem}</p>}
        {erro && <p className="erro">{erro}</p>}
      </div>

      <BuscaManual onAdicionar={adicionarItem} />

      <div className="card">
        <CarrinhoList itens={itens} onRemover={removerItem} />
        <button onClick={confirmarLancamento} disabled={itens.length === 0 || salvando}>
          {salvando ? 'Confirmando...' : 'Confirmar lançamento'}
        </button>
      </div>
    </div>
  )
}
