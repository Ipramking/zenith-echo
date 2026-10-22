import { money } from '../lib/format'
import { useSettings } from './settings'
import { useStore } from './store'

/** Checks an outgoing amount (fees included) against what is left of today's limit. */
export function useDailyLimit(total: number): { over: boolean; msg: string | null } {
  const { spentToday } = useStore()
  const { settings } = useSettings()
  const left = Math.max(0, settings.dailyLimit - spentToday())
  const over = total > 0 && total > left
  return { over, msg: over ? `Over your daily limit of ${money(settings.dailyLimit)}. You can still send ${money(left)} today.` : null }
}
