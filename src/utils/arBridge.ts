import type { ArToApp, AppToAr } from '../types/ar'
import { arToAppSchema, appToArSchema } from './validators/arSchemas'

const get8thwallOrigin = (): string => {
  if (typeof window === 'undefined') return '*'
  const origin = process.env.NEXT_PUBLIC_8THWALL_ORIGIN
  if (!origin) {
    console.warn('NEXT_PUBLIC_8THWALL_ORIGIN not set, using wildcard (development only)')
    return '*'
  }
  return origin
}

const getAppOrigin = (): string => {
  if (typeof window === 'undefined') return '*'
  const origin = process.env.NEXT_PUBLIC_ALLOWED_ORIGIN
  if (!origin) {
    console.warn('NEXT_PUBLIC_ALLOWED_ORIGIN not set, using wildcard (development only)')
    return '*'
  }
  return origin
}

export const arBridge = {
  sendToAr: (iframe: HTMLIFrameElement | null, message: AppToAr): void => {
    if (!iframe?.contentWindow) {
      console.error('AR bridge: iframe not ready')
      return
    }

    try {
      const validated = appToArSchema.parse(message)
      const targetOrigin = get8thwallOrigin()
      iframe.contentWindow.postMessage(validated, targetOrigin)
    } catch (error) {
      console.error('AR bridge: validation error', error)
    }
  },

  receiveFromAr: (
    event: MessageEvent,
    handler: (message: ArToApp) => void
  ): boolean => {
    const allowedOrigin = get8thwallOrigin()

    if (allowedOrigin !== '*' && event.origin !== allowedOrigin) {
      console.warn(`AR bridge: origin mismatch. Expected: ${allowedOrigin}, Got: ${event.origin}`)
      return false
    }

    try {
      const validated = arToAppSchema.parse(event.data)
      console.log('AR bridge: received message', validated)
      handler(validated)
      return true
    } catch (error) {
      console.error('AR bridge: validation error on receive', error, event.data)
      return false
    }
  },

  validateOrigin: (origin: string): boolean => {
    const allowedOrigin = getAppOrigin()
    if (allowedOrigin === '*') return true
    return origin === allowedOrigin
  },
}

