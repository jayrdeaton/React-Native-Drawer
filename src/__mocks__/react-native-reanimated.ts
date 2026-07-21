import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

export const useSharedValue = (initial: number) => {
  const ref = React.useRef({ value: initial })
  return ref.current
}

export const useAnimatedStyle = (factory: () => Record<string, unknown>) => factory()

export const withSpring = (toValue: number) => toValue

export const runOnJS =
  <Args extends unknown[], Return>(fn: (...args: Args) => Return) =>
  (...args: Args) =>
    fn(...args)

const Animated = {
  View: jest.fn(stub)
}

export default Animated
