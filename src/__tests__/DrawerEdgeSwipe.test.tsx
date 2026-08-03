import { render } from '@testing-library/react'
import React from 'react'
import { GestureDetector } from 'react-native-gesture-handler'
import type { SharedValue } from 'react-native-reanimated'

import { DrawerEdgeSwipe } from '../DrawerEdgeSwipe'

const MockGestureDetector = GestureDetector as unknown as jest.Mock

type MockedGesture = { __getHandlers: () => { enabled: boolean; onEnd?: (event: { translationX: number; translationY: number; velocityX: number; velocityY: number }) => void; onUpdate?: (event: { translationX: number; translationY: number; velocityX: number; velocityY: number }) => void } }

const lastGesture = () => (MockGestureDetector.mock.calls[MockGestureDetector.mock.calls.length - 1][0].gesture as MockedGesture).__getHandlers()
const lastGestureProps = () => MockGestureDetector.mock.calls[MockGestureDetector.mock.calls.length - 1][0]

const sharedValue = (initial: number) => ({ value: initial }) as SharedValue<number>

const event = (translationX: number, velocityX: number) => ({ translationX, translationY: 0, velocityX, velocityY: 0 })
const verticalEvent = (translationY: number, velocityY: number) => ({ translationX: 0, translationY, velocityX: 0, velocityY })

const flattenStyle = (style: unknown): Record<string, unknown> => (Array.isArray(style) ? style : [style]).reduce((acc: Record<string, unknown>, s) => ({ ...acc, ...(s as Record<string, unknown>) }), {})

describe('DrawerEdgeSwipe', () => {
  beforeEach(() => jest.clearAllMocks())

  it('commits open when dragged past a third of the width', () => {
    const onOpen = jest.fn()
    const translateOffset = sharedValue(-300)
    render(<DrawerEdgeSwipe onOpen={onOpen} translateOffset={translateOffset} width={300} />)

    lastGesture().onEnd?.(event(150, 0))

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(translateOffset.value).toBe(0)
  })

  it('snaps back closed when the drag is short and slow', () => {
    const onOpen = jest.fn()
    const translateOffset = sharedValue(-300)
    render(<DrawerEdgeSwipe onOpen={onOpen} translateOffset={translateOffset} width={300} />)

    lastGesture().onEnd?.(event(50, 0))

    expect(onOpen).not.toHaveBeenCalled()
    expect(translateOffset.value).toBe(-300)
  })

  it('commits open on a fast flick even with a short drag', () => {
    const onOpen = jest.fn()
    const translateOffset = sharedValue(-300)
    render(<DrawerEdgeSwipe onOpen={onOpen} translateOffset={translateOffset} width={300} />)

    lastGesture().onEnd?.(event(10, 800))

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('inverts the commit direction for a right-side drawer', () => {
    const onOpen = jest.fn()
    const translateOffset = sharedValue(300)
    render(<DrawerEdgeSwipe onOpen={onOpen} side='right' translateOffset={translateOffset} width={300} />)

    lastGesture().onEnd?.(event(-150, 0))

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('clamps translateOffset during a drag to within [closedOffset, 0] for a left drawer', () => {
    const translateOffset = sharedValue(-300)
    render(<DrawerEdgeSwipe onOpen={jest.fn()} translateOffset={translateOffset} width={300} />)

    const { onUpdate } = lastGesture()
    onUpdate?.(event(1000, 0))
    expect(translateOffset.value).toBe(0)

    onUpdate?.(event(-1000, 0))
    expect(translateOffset.value).toBe(-300)
  })

  it('passes enabled through to the gesture', () => {
    const translateOffset = sharedValue(-300)
    render(<DrawerEdgeSwipe enabled={false} onOpen={jest.fn()} translateOffset={translateOffset} width={300} />)

    expect(lastGesture().enabled).toBe(false)
  })

  it('commits open on a top drawer when dragged past a third of the height using the vertical axis', () => {
    const onOpen = jest.fn()
    const translateOffset = sharedValue(-250)
    render(<DrawerEdgeSwipe height={250} onOpen={onOpen} side='top' translateOffset={translateOffset} />)

    const { onUpdate, onEnd } = lastGesture()
    onUpdate?.(verticalEvent(1000, 0))
    expect(translateOffset.value).toBe(0)

    onEnd?.(verticalEvent(150, 0))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(translateOffset.value).toBe(0)
  })

  it('inverts the commit direction for a bottom drawer using the vertical axis', () => {
    const onOpen = jest.fn()
    const translateOffset = sharedValue(250)
    render(<DrawerEdgeSwipe height={250} onOpen={onOpen} side='bottom' translateOffset={translateOffset} />)

    const { onUpdate, onEnd } = lastGesture()
    onUpdate?.(verticalEvent(-1000, 0))
    expect(translateOffset.value).toBe(0)

    onEnd?.(verticalEvent(-150, 0))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('renders a horizontal edge strip anchored to the top for a top drawer', () => {
    const translateOffset = sharedValue(-250)
    render(<DrawerEdgeSwipe height={250} onOpen={jest.fn()} side='top' translateOffset={translateOffset} />)

    const style = flattenStyle(lastGestureProps().children.props.style)
    expect(style).toMatchObject({ height: 24, left: 0, right: 0, top: 0 })
    expect(style.width).toBeUndefined()
    expect(style.bottom).toBeUndefined()
  })

  it('renders a horizontal edge strip anchored to the bottom for a bottom drawer', () => {
    const translateOffset = sharedValue(250)
    render(<DrawerEdgeSwipe height={250} onOpen={jest.fn()} side='bottom' translateOffset={translateOffset} />)

    const style = flattenStyle(lastGestureProps().children.props.style)
    expect(style).toMatchObject({ height: 24, left: 0, right: 0, bottom: 0 })
    expect(style.width).toBeUndefined()
    expect(style.top).toBeUndefined()
  })
})
