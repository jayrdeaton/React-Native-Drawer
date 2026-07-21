import { render } from '@testing-library/react'
import React from 'react'
import { GestureDetector } from 'react-native-gesture-handler'
import type { SharedValue } from 'react-native-reanimated'

import { DrawerEdgeSwipe } from '../DrawerEdgeSwipe'

const MockGestureDetector = GestureDetector as unknown as jest.Mock

type MockedGesture = { __getHandlers: () => { enabled: boolean; onEnd?: (event: { translationX: number; velocityX: number }) => void; onUpdate?: (event: { translationX: number; velocityX: number }) => void } }

const lastGesture = () => (MockGestureDetector.mock.calls[MockGestureDetector.mock.calls.length - 1][0].gesture as MockedGesture).__getHandlers()

const sharedValue = (initial: number) => ({ value: initial }) as SharedValue<number>

describe('DrawerEdgeSwipe', () => {
  beforeEach(() => jest.clearAllMocks())

  it('commits open when dragged past a third of the width', () => {
    const onOpen = jest.fn()
    const translateX = sharedValue(-300)
    render(<DrawerEdgeSwipe onOpen={onOpen} translateX={translateX} width={300} />)

    lastGesture().onEnd?.({ translationX: 150, velocityX: 0 })

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(translateX.value).toBe(0)
  })

  it('snaps back closed when the drag is short and slow', () => {
    const onOpen = jest.fn()
    const translateX = sharedValue(-300)
    render(<DrawerEdgeSwipe onOpen={onOpen} translateX={translateX} width={300} />)

    lastGesture().onEnd?.({ translationX: 50, velocityX: 0 })

    expect(onOpen).not.toHaveBeenCalled()
    expect(translateX.value).toBe(-300)
  })

  it('commits open on a fast flick even with a short drag', () => {
    const onOpen = jest.fn()
    const translateX = sharedValue(-300)
    render(<DrawerEdgeSwipe onOpen={onOpen} translateX={translateX} width={300} />)

    lastGesture().onEnd?.({ translationX: 10, velocityX: 800 })

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('inverts the commit direction for a right-side drawer', () => {
    const onOpen = jest.fn()
    const translateX = sharedValue(300)
    render(<DrawerEdgeSwipe onOpen={onOpen} side='right' translateX={translateX} width={300} />)

    lastGesture().onEnd?.({ translationX: -150, velocityX: 0 })

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('clamps translateX during a drag to within [closedX, 0] for a left drawer', () => {
    const translateX = sharedValue(-300)
    render(<DrawerEdgeSwipe onOpen={jest.fn()} translateX={translateX} width={300} />)

    const { onUpdate } = lastGesture()
    onUpdate?.({ translationX: 1000, velocityX: 0 })
    expect(translateX.value).toBe(0)

    onUpdate?.({ translationX: -1000, velocityX: 0 })
    expect(translateX.value).toBe(-300)
  })

  it('passes enabled through to the gesture', () => {
    const translateX = sharedValue(-300)
    render(<DrawerEdgeSwipe enabled={false} onOpen={jest.fn()} translateX={translateX} width={300} />)

    expect(lastGesture().enabled).toBe(false)
  })
})
