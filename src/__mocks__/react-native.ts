import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

const StyleSheet = {
  create: <T extends object>(styles: T): T => styles,
  flatten: (style: unknown) => style,
  absoluteFill: {}
}

export { StyleSheet }

export const View = jest.fn(stub)

// Only .OS is read anywhere in this package (the webCursorStyles and Drawer.tsx's clipOverflowStyle):
// defaulted to 'ios' so those branches resolve the same way they would on a real native device, not
// the web-only paths. Specs covering a web path set it to 'web' and restore it afterward.
export const Platform = { OS: 'ios' as 'android' | 'ios' | 'web' }

// addEventListener is a jest.fn so specs can pull the registered handler off its mock.calls (the
// same escape hatch pattern as the gesture-handler and withSpring mocks) and invoke it manually to
// simulate a hardware back-button press, asserting on its boolean return.
export const BackHandler = {
  addEventListener: jest.fn((_eventName: 'hardwareBackPress', _handler: () => boolean) => ({ remove: jest.fn() }))
}

// A jest.fn so a spec can mockReturnValueOnce a different window size to exercise percentage-based
// height/width resolution; defaults to an arbitrary but fixed size for every other spec, which
// mostly pass plain px numbers that never consult this at all.
export const useWindowDimensions = jest.fn(() => ({ fontScale: 1, height: 800, scale: 1, width: 400 }))
