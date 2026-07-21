import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

type PanEvent = { translationX: number; velocityX: number }

// A minimal stand-in for react-native-gesture-handler's chainable Gesture.Pan() builder.
// __getHandlers() is a test-only escape hatch (not part of the real API) so specs can invoke
// onUpdate/onEnd directly instead of driving a real native gesture.
class PanGestureBuilder {
  private isEnabled = true
  private onEndHandler?: (event: PanEvent) => void
  private onUpdateHandler?: (event: PanEvent) => void

  enabled(value: boolean) {
    this.isEnabled = value
    return this
  }

  activeOffsetX() {
    return this
  }

  failOffsetY() {
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
    return { enabled: this.isEnabled, onEnd: this.onEndHandler, onUpdate: this.onUpdateHandler }
  }
}

export const Gesture = {
  Pan: () => new PanGestureBuilder()
}

export const GestureDetector = jest.fn(stub)
