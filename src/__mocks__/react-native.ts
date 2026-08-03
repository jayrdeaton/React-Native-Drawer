import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

const StyleSheet = {
  create: <T extends object>(styles: T): T => styles,
  flatten: (style: unknown) => style,
  absoluteFill: {}
}

export { StyleSheet }

export const View = jest.fn(stub)

// Only .OS is read anywhere in this package (Drawer.tsx's webCursorStyle) — defaulted to 'ios' so
// that branch resolves the same way it would on a real native device, not the web-only cursor path.
export const Platform = { OS: 'ios' as 'android' | 'ios' | 'web' }

// addEventListener is a jest.fn so specs can pull the registered handler off its mock.calls (the
// same escape hatch pattern as the gesture-handler and withSpring mocks) and invoke it manually to
// simulate a hardware back-button press, asserting on its boolean return.
export const BackHandler = {
  addEventListener: jest.fn((_eventName: 'hardwareBackPress', _handler: () => boolean) => ({ remove: jest.fn() }))
}
