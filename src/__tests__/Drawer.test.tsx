import { Pressable } from '@rific/haptic-press'
import { BlurView, useBlur } from '@rific/auto-paper'
import { act, render, screen } from '@testing-library/react'
import React from 'react'
import { View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, { type SharedValue, withSpring } from 'react-native-reanimated'

import { Drawer } from '../Drawer'

const MockPressable = Pressable as unknown as jest.Mock
const MockBlurView = BlurView as unknown as jest.Mock
const mockUseBlur = useBlur as unknown as jest.Mock
const MockView = View as unknown as jest.Mock
const MockGestureDetector = GestureDetector as unknown as jest.Mock
const MockAnimatedView = Animated.View as unknown as jest.Mock
const MockWithSpring = withSpring as unknown as jest.Mock

// withSpring's 3rd arg is the finished-callback, passed on both the open and close paths (onOpened
// and onClosed respectively) — grabs the most recent one so a test can simulate that spring settling,
// same idea as lastGesture() below.
const lastSpringFinishCallback = () => [...MockWithSpring.mock.calls].reverse().find((call) => typeof call[2] === 'function')?.[2] as ((finished?: boolean) => void) | undefined

type MockedGesture = { __getHandlers: () => { enabled: boolean; onEnd?: (event: { translationX: number; translationY: number; velocityX: number; velocityY: number }) => void; onUpdate?: (event: { translationX: number; translationY: number; velocityX: number; velocityY: number }) => void } }

const lastGesture = () => (MockGestureDetector.mock.calls[MockGestureDetector.mock.calls.length - 1][0].gesture as MockedGesture).__getHandlers()
const event = (translationX: number, velocityX: number) => ({ translationX, translationY: 0, velocityX, velocityY: 0 })
const sharedValue = (initial: number) => ({ value: initial }) as SharedValue<number>

const flattenStyle = (style: unknown): Record<string, unknown> => (Array.isArray(style) ? style : [style]).reduce((acc: Record<string, unknown>, s) => ({ ...acc, ...(s as Record<string, unknown>) }), {})

const drawerPanelStyle = () => flattenStyle(MockAnimatedView.mock.calls.find((call) => flattenStyle(call[0].style).zIndex === 51)?.[0].style)
const backdropCall = () => MockAnimatedView.mock.calls.find((call) => flattenStyle(call[0].style).zIndex === 50)?.[0]

describe('Drawer', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls onClose when the backdrop is pressed', () => {
    const onClose = jest.fn()
    render(<Drawer onClose={onClose} open />)

    MockPressable.mock.calls[0][0].onPress()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders its content', () => {
    render(
      <Drawer onClose={jest.fn()} open>
        <span>drawer content</span>
      </Drawer>
    )

    expect(screen.getByText('drawer content')).toBeTruthy()
  })

  it('renders the panel via BlurView when blur resolves true', () => {
    mockUseBlur.mockReturnValueOnce(true)

    render(
      <Drawer blur onClose={jest.fn()} open>
        <span>drawer content</span>
      </Drawer>
    )

    expect(MockBlurView).toHaveBeenCalled()
    expect(screen.getByText('drawer content')).toBeTruthy()
  })

  it('falls back to a plain solid background when blur resolves false', () => {
    mockUseBlur.mockReturnValueOnce(false)

    render(
      <Drawer blur={false} onClose={jest.fn()} open>
        <span>drawer content</span>
      </Drawer>
    )

    expect(MockBlurView).not.toHaveBeenCalled()
    expect(screen.getByText('drawer content')).toBeTruthy()
  })

  it('passes blur through to useBlur() unmodified when omitted, deferring to its own global preference', () => {
    render(
      <Drawer onClose={jest.fn()} open>
        <span>drawer content</span>
      </Drawer>
    )

    expect(mockUseBlur).toHaveBeenCalledWith(undefined)
  })

  describe('onClosed', () => {
    it('fires once the close animation reports it has actually finished', () => {
      const onClosed = jest.fn()
      const { rerender } = render(
        <Drawer onClose={jest.fn()} onClosed={onClosed} open>
          <span>drawer content</span>
        </Drawer>
      )

      rerender(
        <Drawer onClose={jest.fn()} onClosed={onClosed} open={false}>
          <span>drawer content</span>
        </Drawer>
      )

      // open flipping to false alone must not fire it — only the spring settling does.
      expect(onClosed).not.toHaveBeenCalled()

      act(() => lastSpringFinishCallback()?.(true))

      expect(onClosed).toHaveBeenCalledTimes(1)
    })

    it('does not fire when the close animation is interrupted instead of settling', () => {
      const onClosed = jest.fn()
      const { rerender } = render(
        <Drawer onClose={jest.fn()} onClosed={onClosed} open>
          <span>drawer content</span>
        </Drawer>
      )

      rerender(
        <Drawer onClose={jest.fn()} onClosed={onClosed} open={false}>
          <span>drawer content</span>
        </Drawer>
      )

      act(() => lastSpringFinishCallback()?.(false))

      expect(onClosed).not.toHaveBeenCalled()
    })

    it('is safe to omit — a finishing close animation never throws without a handler', () => {
      const { rerender } = render(
        <Drawer onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      rerender(
        <Drawer onClose={jest.fn()} open={false}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(() => act(() => lastSpringFinishCallback()?.(true))).not.toThrow()
    })
  })

  describe('onOpened', () => {
    it('fires once the open animation reports it has actually finished', () => {
      const onOpened = jest.fn()
      render(
        <Drawer onClose={jest.fn()} onOpened={onOpened} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(onOpened).not.toHaveBeenCalled()

      act(() => lastSpringFinishCallback()?.(true))

      expect(onOpened).toHaveBeenCalledTimes(1)
    })

    it('does not fire when the open animation is interrupted instead of settling', () => {
      const onOpened = jest.fn()
      render(
        <Drawer onClose={jest.fn()} onOpened={onOpened} open>
          <span>drawer content</span>
        </Drawer>
      )

      act(() => lastSpringFinishCallback()?.(false))

      expect(onOpened).not.toHaveBeenCalled()
    })

    it('is independent of onClosed — each only fires for its own direction', () => {
      const onOpened = jest.fn()
      const onClosed = jest.fn()
      const { rerender } = render(
        <Drawer onClose={jest.fn()} onClosed={onClosed} onOpened={onOpened} open>
          <span>drawer content</span>
        </Drawer>
      )

      act(() => lastSpringFinishCallback()?.(true))
      expect(onOpened).toHaveBeenCalledTimes(1)
      expect(onClosed).not.toHaveBeenCalled()

      rerender(
        <Drawer onClose={jest.fn()} onClosed={onClosed} onOpened={onOpened} open={false}>
          <span>drawer content</span>
        </Drawer>
      )
      act(() => lastSpringFinishCallback()?.(true))

      expect(onClosed).toHaveBeenCalledTimes(1)
      expect(onOpened).toHaveBeenCalledTimes(1)
    })

    it('is safe to omit — a finishing open animation never throws without a handler', () => {
      render(
        <Drawer onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(() => act(() => lastSpringFinishCallback()?.(true))).not.toThrow()
    })
  })

  describe('contentSize', () => {
    it('defaults to false and leaves fixed-size behavior completely unchanged', () => {
      render(
        <Drawer height={250} onClose={jest.fn()} open side='bottom'>
          <span>drawer content</span>
        </Drawer>
      )

      // No onLayout wiring on the content wrapper when contentSize is off.
      const contentCall = MockView.mock.calls.find((call) => typeof call[0].onLayout === 'function')
      expect(contentCall).toBeUndefined()

      // The panel keeps its plain, non-animated fixed height style — no clipping, no flex axis.
      const style = drawerPanelStyle()
      expect(style.height).toBe(250)
      expect(style.overflow).toBeUndefined()
      expect(style.flexDirection).toBeUndefined()
    })

    it('measuring the content wrapper updates the measured size, reports it via onMeasure, and flows into the closed-offset math', () => {
      const onMeasure = jest.fn()
      const translateOffset = sharedValue(0)

      render(
        <Drawer contentSize height={300} onClose={jest.fn()} onMeasure={onMeasure} open={false} side='bottom' translateOffset={translateOffset}>
          <span>drawer content</span>
        </Drawer>
      )

      // Before the first measurement, the fixed height prop is the placeholder closed offset.
      expect(translateOffset.value).toBe(300)

      const contentCall = MockView.mock.calls.find((call) => typeof call[0].onLayout === 'function')
      expect(contentCall).toBeDefined()

      act(() => {
        contentCall![0].onLayout({ nativeEvent: { layout: { height: 120, width: 0 } } })
      })

      expect(onMeasure).toHaveBeenCalledWith(120)
      // closedOffset re-derives from the measured size and re-syncs translateOffset (harmless while closed).
      expect(translateOffset.value).toBe(120)
    })

    it('measures width instead of height for a horizontal (left/right) drawer — contentSize is not height-specific', () => {
      const onMeasure = jest.fn()
      const translateOffset = sharedValue(0)

      render(
        <Drawer contentSize onClose={jest.fn()} onMeasure={onMeasure} open={false} side='left' translateOffset={translateOffset} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      // Before the first measurement, the fixed width prop is the placeholder closed offset.
      expect(translateOffset.value).toBe(-300)

      const contentCall = MockView.mock.calls.find((call) => typeof call[0].onLayout === 'function')
      expect(contentCall).toBeDefined()

      act(() => {
        // height set to a different value than width to prove the horizontal axis reads .width, not
        // .height (the two would be indistinguishable if this test reused the same number for both).
        contentCall![0].onLayout({ nativeEvent: { layout: { height: 999, width: 180 } } })
      })

      expect(onMeasure).toHaveBeenCalledWith(180)
      expect(translateOffset.value).toBe(-180)
    })
  })

  describe('dismissible', () => {
    it('renders a drag handle by default', () => {
      render(
        <Drawer onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(MockGestureDetector).toHaveBeenCalledTimes(1)
    })

    it('omits the drag handle when dismissible is false', () => {
      render(
        <Drawer dismissible={false} onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(MockGestureDetector).not.toHaveBeenCalled()
    })

    it('calls onClose when the handle is dragged past a third of the size in the closing direction', () => {
      const onClose = jest.fn()
      const translateOffset = sharedValue(0)
      render(
        <Drawer onClose={onClose} open translateOffset={translateOffset} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      const { onUpdate, onEnd } = lastGesture()
      onUpdate?.(event(-150, 0))
      expect(translateOffset.value).toBe(-150)

      onEnd?.(event(-150, 0))

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(translateOffset.value).toBe(-300)
    })

    it('calls onClose when the handle is dragged past a third of the height on the vertical axis for a top sheet', () => {
      const onClose = jest.fn()
      const translateOffset = sharedValue(0)
      render(
        <Drawer height={300} onClose={onClose} open side='top' translateOffset={translateOffset}>
          <span>drawer content</span>
        </Drawer>
      )

      const verticalEvent = (translationY: number, velocityY: number) => ({ translationX: 0, translationY, velocityX: 0, velocityY })
      const { onUpdate, onEnd } = lastGesture()
      onUpdate?.(verticalEvent(-150, 0))
      expect(translateOffset.value).toBe(-150)

      onEnd?.(verticalEvent(-150, 0))

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(translateOffset.value).toBe(-300)
    })

    it('springs back open without calling onClose when the drag is short and slow', () => {
      const onClose = jest.fn()
      const translateOffset = sharedValue(0)
      render(
        <Drawer onClose={onClose} open translateOffset={translateOffset} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      lastGesture().onEnd?.(event(-50, 0))

      expect(onClose).not.toHaveBeenCalled()
      expect(translateOffset.value).toBe(0)
    })

    it('is only enabled while open', () => {
      const translateOffset = sharedValue(0)
      render(
        <Drawer onClose={jest.fn()} open={false} translateOffset={translateOffset} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(lastGesture().enabled).toBe(false)
    })
  })

  describe('blockingBackdrop', () => {
    it('intercepts touches while open by default', () => {
      render(
        <Drawer onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(backdropCall()?.pointerEvents).toBe('auto')
    })

    it('never intercepts touches when blockingBackdrop is false, even while open', () => {
      render(
        <Drawer blockingBackdrop={false} onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(backdropCall()?.pointerEvents).toBe('none')
    })
  })

  describe('backdropOpacity', () => {
    // translateOffset is seeded to 0 (rather than relying on the open-triggered spring effect to
    // reach it) since that effect mutates a SharedValue ref directly — which, unlike setState,
    // triggers no further render here, so a style captured only from the initial render would still
    // reflect the pre-effect closedOffset instead. Seeding it directly makes the very first (and
    // only) render already reflect "fully open."
    it('dims to 0.45 while fully open by default', () => {
      render(
        <Drawer onClose={jest.fn()} open translateOffset={sharedValue(0)}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(flattenStyle(backdropCall()?.style).opacity).toBe(0.45)
    })

    it('renders no dimming at all when set to 0, independent of blockingBackdrop', () => {
      render(
        <Drawer backdropOpacity={0} onClose={jest.fn()} open translateOffset={sharedValue(0)}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(flattenStyle(backdropCall()?.style).opacity).toBe(0)
      // Still blocks touches by default — an undimmed backdrop isn't the same as a non-blocking one.
      expect(backdropCall()?.pointerEvents).toBe('auto')
    })
  })

  describe('showHandle', () => {
    const pillCall = () => MockView.mock.calls.find((call) => flattenStyle(call[0].style).borderRadius === 3)

    it('renders the grip pill by default', () => {
      render(
        <Drawer onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(pillCall()).toBeDefined()
    })

    it('omits just the pill graphic when false, while keeping the strip (and its drag-to-dismiss gesture) intact', () => {
      render(
        <Drawer onClose={jest.fn()} open showHandle={false}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(pillCall()).toBeUndefined()
      // The strip itself — and the gesture attached to it — is unaffected by showHandle; only
      // `dismissible` controls whether either renders at all (see the dismissible tests above).
      expect(MockGestureDetector).toHaveBeenCalledTimes(1)
    })
  })

  describe('zIndex', () => {
    // Located positionally rather than by their own zIndex (which is exactly what's under test here)
    // — Drawer always renders its backdrop as the first Animated.View and its panel as the second.
    const handleStripCall = () => MockView.mock.calls.find((call) => flattenStyle(call[0].style).justifyContent === 'center')

    it('defaults the backdrop/panel/handle to 50/51/52', () => {
      render(
        <Drawer onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(flattenStyle(MockAnimatedView.mock.calls[0][0].style).zIndex).toBe(50)
      expect(flattenStyle(MockAnimatedView.mock.calls[1][0].style).zIndex).toBe(51)
      expect(flattenStyle(handleStripCall()?.[0].style).zIndex).toBe(52)
    })

    it('shifts backdrop/panel/handle together, preserving their relative stacking, when set', () => {
      render(
        <Drawer onClose={jest.fn()} open zIndex={200}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(flattenStyle(MockAnimatedView.mock.calls[0][0].style).zIndex).toBe(200)
      expect(flattenStyle(MockAnimatedView.mock.calls[1][0].style).zIndex).toBe(201)
      expect(flattenStyle(handleStripCall()?.[0].style).zIndex).toBe(202)
    })
  })
})
