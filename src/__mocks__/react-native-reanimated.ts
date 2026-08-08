import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

export const useSharedValue = (initial: number) => {
  const ref = React.useRef({ value: initial })
  return ref.current
}

export const useAnimatedStyle = (factory: () => Record<string, unknown>) => factory()

// Evaluated once per render (using whatever the read SharedValues' .value are at that moment),
// same simplification useAnimatedStyle above makes: not reactive frame-to-frame the way the real
// UI-thread implementation is, but sufficient for specs that render with a given seeded value and
// assert the derived result, rather than mutating .value mid-test and expecting a live recompute.
export const useDerivedValue = <T>(factory: () => T) => ({ value: factory() })

// A jest.fn (rather than a plain function) so specs can pull the finished-callback (3rd arg) off
// withSpring.mock.calls and invoke it manually to simulate an animation settling, mirroring the
// __getHandlers() escape hatch the gesture-handler mock uses for onUpdate/onEnd.
export const withSpring = jest.fn((toValue: number, _config?: unknown, _callback?: (finished?: boolean) => void) => toValue)

export const withTiming = (toValue: number) => toValue

export const runOnJS =
  <Args extends unknown[], Return>(fn: (...args: Args) => Return) =>
  (...args: Args) =>
    fn(...args)

const Animated = {
  View: jest.fn(stub)
}

export default Animated
