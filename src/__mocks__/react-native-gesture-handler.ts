import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

type PanEvent = { translationX: number; translationY: number; velocityX: number; velocityY: number }

// A minimal stand-in for react-native-gesture-handler's chainable Gesture.Pan() builder.
// __getHandlers() is a test-only escape hatch (not part of the real API) so specs can invoke
// onUpdate/onEnd directly instead of driving a real native gesture.
class PanGestureBuilder {
  private isEnabled = true
  private onEndHandler?: (event: PanEvent) => void
  private onStartHandler?: () => void
  private onUpdateHandler?: (event: PanEvent) => void

  enabled(value: boolean) {
    this.isEnabled = value
    return this
  }

  activeOffsetX() {
    return this
  }

  activeOffsetY() {
    return this
  }

  failOffsetX() {
    return this
  }

  failOffsetY() {
    return this
  }

  onStart(handler: () => void) {
    this.onStartHandler = handler
    return this
  }

  onUpdate(handler: (event: PanEvent) => void) {
    this.onUpdateHandler = handler
    return this
  }

  onEnd(handler: (event: PanEvent) => void) {
    this.onEndHandler = handler
    return this
  }

  __getHandlers() {
    return { enabled: this.isEnabled, onEnd: this.onEndHandler, onStart: this.onStartHandler, onUpdate: this.onUpdateHandler }
  }
}

type TapEvent = Record<string, never>

// A minimal stand-in for react-native-gesture-handler's chainable Gesture.Tap() builder — same
// __getHandlers() escape hatch as PanGestureBuilder above, for specs that need to invoke onEnd
// directly (e.g. Drawer's own backdrop-tap-to-close) rather than driving a real native gesture.
class TapGestureBuilder {
  private isEnabled = true
  private onEndHandler?: (event: TapEvent, success: boolean) => void

  enabled(value: boolean) {
    this.isEnabled = value
    return this
  }

  onEnd(handler: (event: TapEvent, success: boolean) => void) {
    this.onEndHandler = handler
    return this
  }

  __getHandlers() {
    return { enabled: this.isEnabled, onEnd: this.onEndHandler }
  }
}

export const Gesture = {
  Pan: () => new PanGestureBuilder(),
  Tap: () => new TapGestureBuilder()
}

export const GestureDetector = jest.fn(stub)
