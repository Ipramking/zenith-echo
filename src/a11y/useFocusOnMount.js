import { useEffect, useRef } from 'react'

export default function useFocusOnMount() {
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return ref
}