/** Stop waiting promptly without leaving an abort listener or an unhandled rejection. */
export async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  let onAbort = (): void => {}
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason)
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    return await Promise.race([promise, aborted])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

/** A disposable deadline; unlike AbortSignal.timeout, its timer ends with the operation. */
export async function withDeadline<T>(
  parent: AbortSignal,
  milliseconds: number,
  message: string,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  parent.throwIfAborted()
  const deadline = new AbortController()
  const signal = AbortSignal.any([parent, deadline.signal])
  const timer = setTimeout(() => deadline.abort(new Error(message)), milliseconds)
  timer.unref()
  try {
    const result = await abortable(operation(signal), signal)
    signal.throwIfAborted()
    return result
  } finally {
    clearTimeout(timer)
  }
}
