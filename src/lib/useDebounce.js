import { useEffect, useState } from 'react'

/** Atrasa a propagação de um valor — evita disparar uma busca a cada tecla digitada. */
export function useDebounce(valor, atrasoMs = 300) {
  const [valorAtrasado, setValorAtrasado] = useState(valor)

  useEffect(() => {
    const timer = setTimeout(() => setValorAtrasado(valor), atrasoMs)
    return () => clearTimeout(timer)
  }, [valor, atrasoMs])

  return valorAtrasado
}
