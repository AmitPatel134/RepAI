/**
 * One-shot signal: the dashboard page calls signalReady() when its data is loaded.
 * The layout listens via onInitialLoad() to complete the progress bar.
 * The _done flag ensures the callback fires at most once per session.
 */

let _cb: (() => void) | null = null
let _done = false

export function onInitialLoad(cb: () => void) {
  if (_done) { cb(); return }
  _cb = cb
}

export function signalReady() {
  if (_done) return
  _done = true
  _cb?.()
  _cb = null
}
