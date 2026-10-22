import { useEffect, useRef } from 'react'
import { useSettings } from '../state/settings'
import { useEcho } from './echo'

const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [role="switch"], [role="radio"], [role="checkbox"], [role="option"], [role="tab"]'
const READABLE = 'h1, h2, h3, p, li, dt, dd, label, output, small, time, b, span'

/** Keep it short: the first sentence, at most a dozen or so words. */
function brief(text: string, max = 14): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const first = clean.split(/(?<=[.!?])\s/)[0] ?? clean
  const w = first.split(' ')
  return w.length > max ? w.slice(0, max).join(' ') : first
}

/** The spoken name of a control: aria-label, then the row's heading, then its label, then its visible text. */
function nameOf(el: Element): string {
  const aria = el.getAttribute('aria-label')
  if (aria) return aria
  const by = el.getAttribute('aria-labelledby')
  if (by) {
    const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
    if (t) return t
  }
  const rowTitle = el.querySelector('.row-text b, b, strong')?.textContent?.trim()
  if (rowTitle) return rowTitle
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    const label = el.closest('label')?.querySelector('span')?.textContent?.trim()
    if (label) return label
    if (el instanceof HTMLInputElement && el.placeholder) return el.placeholder
  }
  return brief((el as HTMLElement).innerText ?? el.textContent ?? '', 8)
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
  return `${name}, button${dim}`
}

const readText = (el: Element) => brief((el as HTMLElement).innerText ?? '')

const visible = (el: Element) => (el as HTMLElement).offsetParent !== null && !el.closest('[aria-hidden="true"]')

/**
 * Touch and read, the way TalkBack works: one tap reads what is under your finger and selects it, a double tap
 * (anywhere) activates the selected item, and a swipe right or left moves to the next or previous item.
 * Keyboard and screen-reader activations (clicks with no pointer) are never intercepted.
 */
export function useTouchRead() {
  const { settings } = useSettings()
  const echo = useEcho()
  const echoRef = useRef(echo)
  echoRef.current = echo

  useEffect(() => {
    if (settings.interaction !== 'touchRead') return
    let focused: Element | null = null
    let selectedAt = 0
    let lastTap = 0
    let hints = 3 // remind the first few times how to activate
    let touch: { x: number; y: number; t: number } | null = null

    const select = (el: Element, hint: boolean) => {
      document.querySelector('.tr-focus')?.classList.remove('tr-focus')
      el.classList.add('tr-focus')
      focused = el
      selectedAt = performance.now()
      ;(el as HTMLElement).scrollIntoView?.({ block: 'nearest' })
      const extra = hint && hints-- > 0 && !(el as HTMLButtonElement).disabled ? '. Double tap to activate.' : ''
      void echoRef.current.say(describe(el) + extra, { force: true })
    }

    const activate = (el: Element) => {
      const h = el as HTMLElement
      document.querySelector('.tr-focus')?.classList.remove('tr-focus')
      focused = null
      if (h instanceof HTMLInputElement || h instanceof HTMLTextAreaElement || h instanceof HTMLSelectElement) h.focus()
      h.click()
    }

    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) return
      const target = e.target as Element | null
      if (!target?.closest) return
      // A few controls must work on the very first tap, like "Tap anywhere to start", which also unlocks sound.
      if (target.closest('[data-tr-direct]')) return
      const now = performance.now()

      // Double tap anywhere: activate the selected item.
      if (focused && now - lastTap < 350 && document.contains(focused)) {
        e.preventDefault()
        e.stopPropagation()
        lastTap = 0
        activate(focused)
        return
      }
      lastTap = now

      const control = target.closest(INTERACTIVE)
      if (control) {
        if (focused === control && now - selectedAt < 1200) {
          focused = null // second tap on the same item: let the click through, which activates it
          document.querySelector('.tr-focus')?.classList.remove('tr-focus')
          return
        }
        e.preventDefault()
        e.stopPropagation()
        select(control, true)
        return
      }
      const block = target.closest(READABLE)
      if (block) {
        const t = readText(block)
        if (t) void echoRef.current.say(t, { force: true })
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      const p = e.touches[0]
      touch = p && e.touches.length === 1 ? { x: p.clientX, y: p.clientY, t: performance.now() } : null
    }

    // Swipe right: next item. Swipe left: previous item.
    const onTouchEnd = (e: TouchEvent) => {
      const start = touch
      touch = null
      const p = e.changedTouches[0]
      if (!start || !p) return
      const dx = p.clientX - start.x
      const dy = p.clientY - start.y
      if (performance.now() - start.t > 700 || Math.abs(dx) < 60 || Math.abs(dy) > 50) return
      const items = Array.from(document.querySelectorAll(INTERACTIVE)).filter(visible)
      if (!items.length) return
      const at = focused ? items.indexOf(focused) : -1
      const next = items[Math.max(0, Math.min(items.length - 1, at + (dx > 0 ? 1 : -1)))]
      if (next) select(next, false)
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true })
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('touchend', onTouchEnd, true)
      document.querySelector('.tr-focus')?.classList.remove('tr-focus')
    }
  }, [settings.interaction])
}
