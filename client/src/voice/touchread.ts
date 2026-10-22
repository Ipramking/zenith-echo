import { useEffect, useRef } from 'react'
import { useSettings } from '../state/settings'
import { useEcho } from './echo'

const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [role="switch"], [role="radio"], [role="checkbox"], [role="option"], [role="tab"]'
const READABLE = 'h1, h2, h3, p, li, dt, dd, label, output, small, time, b, span'

/** The spoken name of a control: aria-label, then the row's heading, then its label, then its visible text. */
function nameOf(el: Element): string {
  const aria = el.getAttribute('aria-label')
  if (aria) return aria
  const by = el.getAttribute('aria-labelledby')
  if (by) {
    const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
    if (t) return t
  }
  const rowTitle = el.querySelector('.row-text b')?.textContent?.trim()
  if (rowTitle) return rowTitle
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    const label = el.closest('label')?.querySelector('span')?.textContent?.trim()
    if (label) return label
    if (el instanceof HTMLInputElement && el.placeholder) return el.placeholder
  }
  return ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function describe(el: Element): string {
  const name = nameOf(el) || 'unlabelled'
  const role = el.getAttribute('role')
  const dim = (el as HTMLButtonElement).disabled ? ', dimmed' : ''
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return `${name}, edit text, ${el.value ? el.value : 'empty'}${dim}`
  if (el instanceof HTMLSelectElement) return `${name}, dropdown, ${el.selectedOptions[0]?.text ?? ''}${dim}`
  if (role === 'switch') return `${name}, switch, ${el.getAttribute('aria-checked') === 'true' ? 'on' : 'off'}${dim}`
  if (role === 'radio' || role === 'option' || role === 'tab') return `${name}, ${role === 'radio' ? 'radio button' : role}, ${el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true' ? 'selected' : 'not selected'}${dim}`
  if (role === 'checkbox') return `${name}, checkbox, ${el.getAttribute('aria-checked') === 'true' ? 'checked' : 'not checked'}${dim}`
  if (el.tagName === 'A') return `${name}, link${dim}`
  return `${name}, button${dim}`
}

const readText = (el: Element) => ((el as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 240)

/**
 * "Touch and read": a single tap speaks what is under the finger, a double tap on the same item activates it.
 * Keyboard and screen-reader activations (clicks with no pointer) are never intercepted.
 */
export function useTouchRead() {
  const { settings } = useSettings()
  const echo = useEcho()
  const echoRef = useRef(echo)
  echoRef.current = echo

  useEffect(() => {
    if (settings.interaction !== 'touchRead') return
    let armed: { el: Element; t: number } | null = null
    let hints = 3 // remind the first few times how to activate

    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) return
      const target = e.target as Element | null
      if (!target?.closest) return
      const control = target.closest(INTERACTIVE)
      if (control) {
        const now = performance.now()
        if (armed && armed.el === control && now - armed.t < 1200) {
          armed = null // second tap: let the click through, which activates it
          return
        }
        e.preventDefault()
        e.stopPropagation()
        armed = { el: control, t: now }
        const hint = hints-- > 0 && !(control as HTMLButtonElement).disabled ? '. Double tap to activate.' : ''
        void echoRef.current.say(describe(control) + hint, { force: true })
        return
      }
      const block = target.closest(READABLE)
      if (block) {
        const t = readText(block)
        if (t) void echoRef.current.say(t, { force: true })
      }
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [settings.interaction])
}
