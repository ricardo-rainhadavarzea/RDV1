import { useEffect, useRef, useState } from 'react'

/**
 * Campo pra bipagem via leitor USB. Não depende do "Enter" do leitor (cada
 * leitor tem uma configuração de terminador diferente) — processa
 * automaticamente assim que o campo acumula 13 dígitos.
 */
export default function ScannerInput({ onCodigoCompleto, desabilitado }) {
  const [valor, setValor] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!desabilitado) inputRef.current?.focus()
  }, [desabilitado])

  function handleChange(e) {
    const digitos = e.target.value.replace(/\D/g, '')
    if (digitos.length >= 13) {
      onCodigoCompleto(digitos.slice(0, 13))
      setValor('')
    } else {
      setValor(digitos)
    }
  }

  return (
    <div className="scanner-input">
      <label>Bipar etiqueta</label>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={valor}
        onChange={handleChange}
        disabled={desabilitado}
        placeholder="Aguardando leitura..."
        autoFocus
      />
    </div>
  )
}
