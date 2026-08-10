import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { BackHandler, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, { withSpring } from 'react-native-reanimated'

import { createDrawer } from '../createDrawer'

const MockView = View as unknown as jest.Mock
const MockGestureDetector = GestureDetector as unknown as jest.Mock
const MockAnimatedView = Animated.View as unknown as jest.Mock
const MockWithSpring = withSpring as unknown as jest.Mock
const MockAddEventListener = BackHandler.addEventListener as unknown as jest.Mock

// withSpring's 3rd arg is the finished-callback (passed on both the open and close paths); grabs
// the most recent call so a test can simulate that spring settling, the trigger for isVisible
// dropping false after a close.
const finishCloseAnimation = () => act(() => [...MockWithSpring.mock.calls].reverse().find((call) => typeof call[2] === 'function')?.[2](true))

// Grabs the handler passed to the most recent BackHandler.addEventListener('hardwareBackPress', ...)
// call, so a test can invoke it directly to simulate a hardware back-button press. Returns the
// handler's own return value (RN's contract: true means "consumed, don't propagate further").
const pressHardwareBack = (): boolean | undefined => {
  let consumed: boolean | undefined
  act(() => {
    consumed = [...MockAddEventListener.mock.calls].reverse().find((call) => call[0] === 'hardwareBackPress')?.[1]()
  })
  return consumed
}

const flattenStyle = (style: unknown): Record<string, unknown> => (Array.isArray(style) ? style : [style]).reduce((acc: Record<string, unknown>, s) => ({ ...acc, ...(s as Record<string, unknown>) }), {})

// Drawer's own dismiss-handle GestureDetector, the most recently rendered one whenever dismissible
// is on (the default): DrawerEdgeSwipe's edge-zone GestureDetector renders first, in JSX order.
type MockedGesture = { __getHandlers: () => { onEnd?: (event: { translationX: number; translationY: number; velocityX: number; velocityY: number }) => void; onStart?: () => void; onUpdate?: (event: { translationX: number; translationY: number; velocityX: number; velocityY: number }) => void } }
type MockedTapGesture = { __getHandlers: () => { enabled: boolean; onEnd?: (event: Record<string, never>, success: boolean) => void } }
const lastGesture = () => (MockGestureDetector.mock.calls[MockGestureDetector.mock.calls.length - 1][0].gesture as MockedGesture).__getHandlers()
// Drawer's own backdrop Gesture.Tap(), the second GestureDetector rendered: DrawerEdgeSwipe's
// edge-zone GestureDetector renders first (see the comment above), and Drawer's backdrop tap
// always comes right after it, ahead of the (optional) dismiss handle.
const backdropGesture = () => (MockGestureDetector.mock.calls[1][0].gesture as MockedTapGesture).__getHandlers()
const verticalEvent = (translationY: number, velocityY: number) => ({ translationX: 0, translationY, velocityX: 0, velocityY })

// The dimming tint's opacity/backgroundColor moved to its own child (backdropTint) once the
// dimming layer and the tap-catching layer split apart (see Drawer.tsx); pointerEvents moved from
// a bare prop into the outer backdrop container's own style array. Mirrors backdropCall/
// backdropTintCall in Drawer.test.tsx.
const backdropCall = () => [...MockAnimatedView.mock.calls].reverse().find((call) => flattenStyle(call[0].style).zIndex === 50)?.[0]
const backdropTintCall = () => [...MockAnimatedView.mock.calls].reverse().find((call) => flattenStyle(call[0].style).backgroundColor === '#000')?.[0]
const backdropPointerEvents = () => flattenStyle(backdropCall()?.style).pointerEvents
const backdropOpacityValue = () => flattenStyle(backdropTintCall()?.style).opacity
// The panel's own zIndex is always exactly one more than the backdrop's (Drawer.tsx: zIndex + 1),
// regardless of the configured base zIndex — not positional, since backdropTint and the
// collapsable backdrop-tap view now render as additional Animated.View calls ahead of the panel.
const drawerPanelStyle = (zIndex = 50) => flattenStyle(MockAnimatedView.mock.calls.find((call) => flattenStyle(call[0].style).zIndex === zIndex + 1)?.[0].style)
const pillRendered = () => MockView.mock.calls.some((call) => flattenStyle(call[0].style).borderRadius === 3)

const OpenableConsumer = ({ useHook }: { useHook: () => { open: () => void } }) => {
  const { open } = useHook()
  return <button onClick={open}>open</button>
}

describe('createDrawer', () => {
  beforeEach(() => jest.clearAllMocks())

  it('closes via a backdrop press, through the full Drawer-to-DrawerInstanceProvider wiring', () => {
    const { DrawerInstanceProvider, useDrawer } = createDrawer()

    const Consumer = () => {
      const { isOpen, open } = useDrawer()
      return (
        <>
          <div data-testid='state'>{isOpen ? 'open' : 'closed'}</div>
          <button onClick={open}>open</button>
        </>
      )
    }

    render(
      <DrawerInstanceProvider content={<span>content</span>}>
        <Consumer />
      </DrawerInstanceProvider>
    )

    fireEvent.click(screen.getByText('open'))
    expect(screen.getByTestId('state').textContent).toBe('open')

    act(() => backdropGesture().onEnd?.({}, true))

    expect(screen.getByTestId('state').textContent).toBe('closed')
  })

  it('starts closed and toggles via open()/close()', () => {
    const { DrawerInstanceProvider, useDrawer } = createDrawer()

    const Consumer = () => {
      const { isOpen, open, close } = useDrawer()
      return (
        <>
          <div data-testid='state'>{isOpen ? 'open' : 'closed'}</div>
          <button onClick={open}>open</button>
          <button onClick={close}>close</button>
        </>
      )
    }

    render(
      <DrawerInstanceProvider>
        <Consumer />
      </DrawerInstanceProvider>
    )

    expect(screen.getByTestId('state').textContent).toBe('closed')
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByTestId('state').textContent).toBe('open')
    fireEvent.click(screen.getByText('close'))
    expect(screen.getByTestId('state').textContent).toBe('closed')
  })

  it('gives independent state to separate createDrawer() instances', () => {
    const left = createDrawer({ side: 'left' })
    const right = createDrawer({ side: 'right' })

    const Consumer = ({ useHook, label }: { useHook: () => ReturnType<typeof left.useDrawer>; label: string }) => {
      const { isOpen, open } = useHook()
      return (
        <>
          <div data-testid={`${label}-state`}>{isOpen ? 'open' : 'closed'}</div>
          <button onClick={open}>{`open-${label}`}</button>
        </>
      )
    }

    render(
      <left.DrawerInstanceProvider>
        <right.DrawerInstanceProvider>
          <Consumer useHook={left.useDrawer} label='left' />
          <Consumer useHook={right.useDrawer} label='right' />
        </right.DrawerInstanceProvider>
      </left.DrawerInstanceProvider>
    )

    fireEvent.click(screen.getByText('open-left'))
    expect(screen.getByTestId('left-state').textContent).toBe('open')
    expect(screen.getByTestId('right-state').textContent).toBe('closed')
  })

  it('starts closed and toggles via open()/close() for a bottom sheet', () => {
    const { DrawerInstanceProvider, useDrawer } = createDrawer({ height: 250, side: 'bottom' })

    const Consumer = () => {
      const { isOpen, open, close } = useDrawer()
      return (
        <>
          <div data-testid='state'>{isOpen ? 'open' : 'closed'}</div>
          <button onClick={open}>open</button>
          <button onClick={close}>close</button>
        </>
      )
    }

    render(
      <DrawerInstanceProvider>
        <Consumer />
      </DrawerInstanceProvider>
    )

    expect(screen.getByTestId('state').textContent).toBe('closed')
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByTestId('state').textContent).toBe('open')
    fireEvent.click(screen.getByText('close'))
    expect(screen.getByTestId('state').textContent).toBe('closed')
  })

  it('useDrawer() outside a Provider returns safe no-op defaults', () => {
    const { useDrawer } = createDrawer()

    const Consumer = () => {
      const { isOpen, isVisible, open, close } = useDrawer()
      expect(isOpen).toBe(false)
      expect(isVisible).toBe(false)
      expect(() => open()).not.toThrow()
      expect(() => close()).not.toThrow()
      return null
    }

    render(<Consumer />)
  })

  it('isVisible stays true through the whole close animation, only dropping once it actually settles', () => {
    const { DrawerInstanceProvider, useDrawer } = createDrawer()

    const Consumer = () => {
      const { close, isOpen, isVisible, open } = useDrawer()
      return (
        <>
          <div data-testid='isOpen'>{String(isOpen)}</div>
          <div data-testid='isVisible'>{String(isVisible)}</div>
          <button onClick={open}>open</button>
          <button onClick={close}>close</button>
        </>
      )
    }

    render(
      <DrawerInstanceProvider content={<span>content</span>}>
        <Consumer />
      </DrawerInstanceProvider>
    )

    fireEvent.click(screen.getByText('open'))
    expect(screen.getByTestId('isOpen').textContent).toBe('true')
    expect(screen.getByTestId('isVisible').textContent).toBe('true')

    fireEvent.click(screen.getByText('close'))
    expect(screen.getByTestId('isOpen').textContent).toBe('false')
    // isOpen has already flipped, but the outro spring hasn't reported finished yet.
    expect(screen.getByTestId('isVisible').textContent).toBe('true')

    finishCloseAnimation()

    expect(screen.getByTestId('isVisible').textContent).toBe('false')
  })

  describe('closeOnBackPress', () => {
    it('closes the drawer on a hardware back press while open, consuming the event', () => {
      const { DrawerInstanceProvider, useDrawer } = createDrawer()

      const Consumer = () => {
        const { isOpen, open } = useDrawer()
        return (
          <>
            <div data-testid='isOpen'>{String(isOpen)}</div>
            <button onClick={open}>open</button>
          </>
        )
      }

      render(
        <DrawerInstanceProvider content={<span>content</span>}>
          <Consumer />
        </DrawerInstanceProvider>
      )
      fireEvent.click(screen.getByText('open'))
      expect(screen.getByTestId('isOpen').textContent).toBe('true')

      const consumed = pressHardwareBack()

      expect(consumed).toBe(true)
      expect(screen.getByTestId('isOpen').textContent).toBe('false')
    })

    it('is not subscribed while the drawer is closed', () => {
      const { DrawerInstanceProvider } = createDrawer()

      render(<DrawerInstanceProvider content={<span>content</span>} />)

      expect(MockAddEventListener).not.toHaveBeenCalled()
    })

    it('settable at the factory level and overridden per-mount', () => {
      const { DrawerInstanceProvider, useDrawer } = createDrawer({ closeOnBackPress: false })

      const { unmount } = render(
        <DrawerInstanceProvider content={<span>content</span>}>
          <OpenableConsumer useHook={useDrawer} />
        </DrawerInstanceProvider>
      )
      fireEvent.click(screen.getByText('open'))
      expect(MockAddEventListener).not.toHaveBeenCalled()
      unmount()

      jest.clearAllMocks()

      render(
        <DrawerInstanceProvider closeOnBackPress content={<span>content</span>}>
          <OpenableConsumer useHook={useDrawer} />
        </DrawerInstanceProvider>
      )
      fireEvent.click(screen.getByText('open'))
      expect(MockAddEventListener).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function))
    })
  })

  it('dismissible: settable at the factory level and overridden per-mount', () => {
    const { DrawerInstanceProvider } = createDrawer({ dismissible: false })

    // Factory default false: DrawerEdgeSwipe's own edge-zone GestureDetector + Drawer's own backdrop
    // Gesture.Tap() (which always renders now, regardless of dismissible), no dismiss handle.
    const { unmount } = render(<DrawerInstanceProvider content={<span>content</span>} />)
    expect(MockGestureDetector).toHaveBeenCalledTimes(2)
    unmount()

    jest.clearAllMocks()

    // Per-mount override back to true: edge zone + backdrop tap + the dismiss handle.
    render(<DrawerInstanceProvider content={<span>content</span>} dismissible />)
    expect(MockGestureDetector).toHaveBeenCalledTimes(3)
  })

  it('blockingBackdrop: settable at the factory level and overridden per-mount', () => {
    const { DrawerInstanceProvider, useDrawer } = createDrawer({ blockingBackdrop: false })

    const { unmount } = render(
      <DrawerInstanceProvider content={<span>content</span>}>
        <OpenableConsumer useHook={useDrawer} />
      </DrawerInstanceProvider>
    )
    fireEvent.click(screen.getByText('open'))
    expect(backdropPointerEvents()).toBe('none')
    unmount()

    jest.clearAllMocks()

    render(
      <DrawerInstanceProvider blockingBackdrop content={<span>content</span>}>
        <OpenableConsumer useHook={useDrawer} />
      </DrawerInstanceProvider>
    )
    fireEvent.click(screen.getByText('open'))
    expect(backdropPointerEvents()).toBe('auto')
  })

  it('backdropOpacity: settable at the factory level and overridden per-mount', () => {
    const { DrawerInstanceProvider, useDrawer } = createDrawer({ backdropOpacity: 0.2 })

    const Consumer = () => {
      const { close, open } = useDrawer()
      return (
        <>
          <button onClick={open}>open</button>
          <button onClick={close}>close</button>
        </>
      )
    }

    const { unmount } = render(
      <DrawerInstanceProvider content={<span>content</span>}>
        <Consumer />
      </DrawerInstanceProvider>
    )
    fireEvent.click(screen.getByText('open'))
    // The open click's own render can't yet reflect its own not-yet-run spring effect (a SharedValue
    // mutation, unlike setState, triggers no further render here): closing immediately after
    // captures the *preceding* render's now-settled (fully open) translateOffset, one step behind,
    // before its own close effect has had a chance to run.
    fireEvent.click(screen.getByText('close'))
    expect(backdropOpacityValue()).toBeCloseTo(0.2)
    unmount()

    jest.clearAllMocks()

    render(
      <DrawerInstanceProvider backdropOpacity={0.45} content={<span>content</span>}>
        <Consumer />
      </DrawerInstanceProvider>
    )
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByText('close'))
    expect(backdropOpacityValue()).toBeCloseTo(0.45)
  })

  it('showHandle: settable at the factory level and overridden per-mount', () => {
    const { DrawerInstanceProvider } = createDrawer({ showHandle: false })

    // Factory default false: the edge-swipe zone, the backdrop's own Gesture.Tap(), and the dismiss
    // handle's own strip still render (dismissible defaults true, independent of showHandle), just
    // without the pill graphic.
    const { unmount } = render(<DrawerInstanceProvider content={<span>content</span>} />)
    expect(pillRendered()).toBe(false)
    expect(MockGestureDetector).toHaveBeenCalledTimes(3)
    unmount()

    jest.clearAllMocks()

    // Per-mount override back to true: pill graphic returns.
    render(<DrawerInstanceProvider content={<span>content</span>} showHandle />)
    expect(pillRendered()).toBe(true)
  })

  it('contentSize: settable at the factory level and overridden per-mount', () => {
    const { DrawerInstanceProvider } = createDrawer({ contentSize: true })

    // Factory default true: the content wrapper gets onLayout wired up for measurement.
    const { unmount } = render(<DrawerInstanceProvider content={<span>content</span>} />)
    expect(MockView.mock.calls.some((call) => typeof call[0].onLayout === 'function')).toBe(true)
    unmount()

    jest.clearAllMocks()

    // Per-mount override back to false: no onLayout wiring, fixed-size behavior.
    render(<DrawerInstanceProvider content={<span>content</span>} contentSize={false} />)
    expect(MockView.mock.calls.some((call) => typeof call[0].onLayout === 'function')).toBe(false)
  })

  describe('zIndex', () => {
    // Positional, not by their own zIndex (that's what's under test): the Drawer this
    // DrawerInstanceProvider renders always produces its backdrop as the first Animated.View call,
    // and nothing else in these tests renders an Animated.View before it.
    const backdropZIndex = () => flattenStyle(MockAnimatedView.mock.calls[0][0].style).zIndex as number
    // Not positional (unlike backdropZIndex above): backdropTint and the collapsable backdrop-tap
    // view both render as additional Animated.View calls ahead of the panel now, so the panel is
    // found by its own zIndex (always backdropZIndex + 1) instead of a fixed call index.
    const panelZIndex = () => drawerPanelStyle(backdropZIndex()).zIndex

    it('settable at the factory level and overridden per-mount', () => {
      const { DrawerInstanceProvider } = createDrawer({ zIndex: 100 })

      const { unmount } = render(<DrawerInstanceProvider content={<span>content</span>} />)
      expect(backdropZIndex()).toBe(100)
      expect(panelZIndex()).toBe(101)
      unmount()

      jest.clearAllMocks()

      render(<DrawerInstanceProvider content={<span>content</span>} zIndex={200} />)
      expect(backdropZIndex()).toBe(200)
      expect(panelZIndex()).toBe(201)
    })

    // The bug this option exists to fix: two createDrawer() instances that can be open at the same
    // time (e.g. in a screen with both a nav drawer and a confirmation sheet) previously had no way
    // to control which one visually stacks on top: plain View zIndex ties break on render order,
    // which combineDrawerProviders/manual nesting fixes independently of which drawer actually makes
    // sense to show on top for a given screen.
    it('lets two simultaneously-open drawers have an explicit, unambiguous stacking order regardless of nesting order', () => {
      const back = createDrawer({ side: 'left', zIndex: 50 })
      const front = createDrawer({ side: 'bottom', zIndex: 100 })

      // `back` is declared outermost: under the old hardcoded zIndex, whichever provider rendered
      // its own Drawer last (here, `back`, since a JSX parent's own trailing elements render after
      // the `children` it wraps) would win the stacking tie regardless of which one this is.
      render(
        <back.DrawerInstanceProvider content={<span>back content</span>}>
          <front.DrawerInstanceProvider content={<span>front content</span>} />
        </back.DrawerInstanceProvider>
      )

      const zIndexes = MockAnimatedView.mock.calls.map((call) => flattenStyle(call[0].style).zIndex).filter((value): value is number => typeof value === 'number')

      // Each Drawer renders exactly one backdrop + one panel + one handle strip Animated.View
      // (dismissible defaults true).
      expect(zIndexes).toHaveLength(6)
      // `front`'s entire backdrop+panel stack sits strictly above all of `back`'s: the configured
      // zIndex wins, not declaration order.
      expect(Math.min(...zIndexes.filter((value) => value >= 100))).toBeGreaterThan(Math.max(...zIndexes.filter((value) => value < 100)))
    })
  })

  describe('maxHeight/maxWidth', () => {
    const panelStyle = () => drawerPanelStyle()

    it('wires through to Drawer, sizing the panel to the max rather than the rest height', () => {
      const { DrawerInstanceProvider } = createDrawer({ height: 300, maxHeight: 800, side: 'bottom' })

      render(<DrawerInstanceProvider content={<span>content</span>} />)

      expect(panelStyle().height).toBe(800)
    })

    it("opening rests below maxHeight, at just `height` px, not fully expanded", () => {
      const { DrawerInstanceProvider, useDrawer } = createDrawer({ height: 300, maxHeight: 800, side: 'bottom' })

      const Consumer = () => {
        const { close, open } = useDrawer()
        return (
          <>
            <button onClick={open}>open</button>
            <button onClick={close}>close</button>
          </>
        )
      }

      render(
        <DrawerInstanceProvider content={<span>content</span>}>
          <Consumer />
        </DrawerInstanceProvider>
      )
      fireEvent.click(screen.getByText('open'))
      // Same one-render-behind trick as the backdropOpacity tests above: the close click's render
      // captures the open click's now-settled translateOffset, before its own close effect runs.
      fireEvent.click(screen.getByText('close'))

      // Backdrop dims proportionally to maxHeight (800), not the smaller rest height (300): at rest
      // only 300/800 of the panel's full extent is covering the screen.
      expect(backdropOpacityValue()).toBeCloseTo(0.45 * (300 / 800))
    })
  })

  describe('edgeInset', () => {
    const panelStyle = () => drawerPanelStyle()

    it('shrinks the basis a percentage maxHeight resolves against, wired through to both Drawer and DrawerEdgeSwipe', () => {
      const { DrawerInstanceProvider } = createDrawer({ edgeInset: 50, height: '50%', maxHeight: '100%', side: 'bottom' })

      render(<DrawerInstanceProvider content={<span>content</span>} />)

      // 800 (mocked window height) - 50 (edgeInset) = 750: `100%` fills exactly up to the inset,
      // not the configured window's full 800.
      expect(panelStyle().height).toBe(750)
    })

    it('leaves a literal pixel maxHeight untouched, even with edgeInset set', () => {
      const { DrawerInstanceProvider } = createDrawer({ edgeInset: 50, height: 300, maxHeight: 800, side: 'bottom' })

      render(<DrawerInstanceProvider content={<span>content</span>} />)

      expect(panelStyle().height).toBe(800)
    })

    it('reaches expandProgress 1 exactly at the (percentage-capped) max, dragged via the handle', () => {
      const { DrawerInstanceProvider, useDrawer } = createDrawer({ edgeInset: 50, height: '50%', maxHeight: '100%', side: 'bottom' })

      let expandProgress: { value: number } | undefined
      const Consumer = () => {
        const { close, open } = useDrawer()
        expandProgress = useDrawer().expandProgress
        return (
          <>
            <button onClick={open}>open</button>
            <button onClick={close}>close</button>
          </>
        )
      }

      render(
        <DrawerInstanceProvider content={<span>content</span>}>
          <Consumer />
        </DrawerInstanceProvider>
      )
      // Opens to rest (375: 50% of the 750 capped basis).
      fireEvent.click(screen.getByText('open'))
      // Drag the handle the rest of the way to the capped max (750, not the window's full 800).
      const { onStart, onUpdate, onEnd } = lastGesture()
      act(() => {
        onStart?.()
        onUpdate?.(verticalEvent(-2000, 0))
        onEnd?.(verticalEvent(-2000, 0))
      })
      // Same one-render-behind trick as the other expandProgress tests: the close click's render
      // captures the drag's already-settled translateOffset (0, fully expanded), before its own
      // close effect has had a chance to run.
      fireEvent.click(screen.getByText('close'))

      expect(expandProgress?.value).toBe(1)
    })

    it('has no effect when omitted, matching prior behavior', () => {
      const { DrawerInstanceProvider } = createDrawer({ height: 300, maxHeight: 800, side: 'bottom' })

      render(<DrawerInstanceProvider content={<span>content</span>} />)

      expect(panelStyle().height).toBe(800)
    })
  })

  describe('expandProgress', () => {
    it('is always a flat 1 when there is no maxHeight/maxWidth: rest already is the full extent', () => {
      const { DrawerInstanceProvider, useDrawer } = createDrawer()

      let expandProgress: { value: number } | undefined
      const Consumer = () => {
        expandProgress = useDrawer().expandProgress
        return null
      }

      render(
        <DrawerInstanceProvider content={<span>content</span>}>
          <Consumer />
        </DrawerInstanceProvider>
      )

      expect(expandProgress?.value).toBe(1)
    })

    it('is 0 once open rests below maxHeight, not 1: resting isn’t the same as fully expanded', () => {
      const { DrawerInstanceProvider, useDrawer } = createDrawer({ height: 300, maxHeight: 800, side: 'bottom' })

      let expandProgress: { value: number } | undefined
      const Consumer = () => {
        const { close, open } = useDrawer()
        expandProgress = useDrawer().expandProgress
        return (
          <>
            <button onClick={open}>open</button>
            <button onClick={close}>close</button>
          </>
        )
      }

      render(
        <DrawerInstanceProvider content={<span>content</span>}>
          <Consumer />
        </DrawerInstanceProvider>
      )
      fireEvent.click(screen.getByText('open'))
      // Same one-render-behind trick as the maxHeight/maxWidth tests above.
      fireEvent.click(screen.getByText('close'))

      expect(expandProgress?.value).toBe(0)
    })
  })
})
