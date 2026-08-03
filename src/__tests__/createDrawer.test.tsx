import { Pressable } from '@rific/haptic-press'
import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { BackHandler, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, { withSpring } from 'react-native-reanimated'

import { createDrawer } from '../createDrawer'

const MockPressable = Pressable as unknown as jest.Mock
const MockView = View as unknown as jest.Mock
const MockGestureDetector = GestureDetector as unknown as jest.Mock
const MockAnimatedView = Animated.View as unknown as jest.Mock
const MockWithSpring = withSpring as unknown as jest.Mock
const MockAddEventListener = BackHandler.addEventListener as unknown as jest.Mock

// withSpring's 3rd arg is the finished-callback (passed on both the open and close paths) — grabs
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

const backdropPointerEvents = () => [...MockAnimatedView.mock.calls].reverse().find((call) => flattenStyle(call[0].style).zIndex === 50)?.[0].pointerEvents
const backdropOpacityValue = () => flattenStyle([...MockAnimatedView.mock.calls].reverse().find((call) => flattenStyle(call[0].style).zIndex === 50)?.[0].style).opacity
const pillRendered = () => MockView.mock.calls.some((call) => flattenStyle(call[0].style).borderRadius === 3)

const OpenableConsumer = ({ useHook }: { useHook: () => { open: () => void } }) => {
  const { open } = useHook()
  return <button onClick={open}>open</button>
}

describe('createDrawer', () => {
  beforeEach(() => jest.clearAllMocks())

  it('closes via a backdrop press, through the full Drawer-to-DrawerProvider wiring', () => {
    const { DrawerProvider, useDrawer } = createDrawer()

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
      <DrawerProvider content={<span>content</span>}>
        <Consumer />
      </DrawerProvider>
    )

    fireEvent.click(screen.getByText('open'))
    expect(screen.getByTestId('state').textContent).toBe('open')

    act(() => MockPressable.mock.calls[0][0].onPress())

    expect(screen.getByTestId('state').textContent).toBe('closed')
  })

  it('starts closed and toggles via open()/close()', () => {
    const { DrawerProvider, useDrawer } = createDrawer()

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
      <DrawerProvider>
        <Consumer />
      </DrawerProvider>
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
      <left.DrawerProvider>
        <right.DrawerProvider>
          <Consumer useHook={left.useDrawer} label='left' />
          <Consumer useHook={right.useDrawer} label='right' />
        </right.DrawerProvider>
      </left.DrawerProvider>
    )

    fireEvent.click(screen.getByText('open-left'))
    expect(screen.getByTestId('left-state').textContent).toBe('open')
    expect(screen.getByTestId('right-state').textContent).toBe('closed')
  })

  it('starts closed and toggles via open()/close() for a bottom sheet', () => {
    const { DrawerProvider, useDrawer } = createDrawer({ height: 250, side: 'bottom' })

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
      <DrawerProvider>
        <Consumer />
      </DrawerProvider>
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
    const { DrawerProvider, useDrawer } = createDrawer()

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
      <DrawerProvider content={<span>content</span>}>
        <Consumer />
      </DrawerProvider>
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
      const { DrawerProvider, useDrawer } = createDrawer()

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
        <DrawerProvider content={<span>content</span>}>
          <Consumer />
        </DrawerProvider>
      )
      fireEvent.click(screen.getByText('open'))
      expect(screen.getByTestId('isOpen').textContent).toBe('true')

      const consumed = pressHardwareBack()

      expect(consumed).toBe(true)
      expect(screen.getByTestId('isOpen').textContent).toBe('false')
    })

    it('is not subscribed while the drawer is closed', () => {
      const { DrawerProvider } = createDrawer()

      render(<DrawerProvider content={<span>content</span>} />)

      expect(MockAddEventListener).not.toHaveBeenCalled()
    })

    it('settable at the factory level and overridden per-mount', () => {
      const { DrawerProvider, useDrawer } = createDrawer({ closeOnBackPress: false })

      const { unmount } = render(
        <DrawerProvider content={<span>content</span>}>
          <OpenableConsumer useHook={useDrawer} />
        </DrawerProvider>
      )
      fireEvent.click(screen.getByText('open'))
      expect(MockAddEventListener).not.toHaveBeenCalled()
      unmount()

      jest.clearAllMocks()

      render(
        <DrawerProvider closeOnBackPress content={<span>content</span>}>
          <OpenableConsumer useHook={useDrawer} />
        </DrawerProvider>
      )
      fireEvent.click(screen.getByText('open'))
      expect(MockAddEventListener).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function))
    })
  })

  it('dismissible: settable at the factory level and overridden per-mount', () => {
    const { DrawerProvider } = createDrawer({ dismissible: false })

    // Factory default false: only DrawerEdgeSwipe's own edge-zone GestureDetector, no dismiss handle.
    const { unmount } = render(<DrawerProvider content={<span>content</span>} />)
    expect(MockGestureDetector).toHaveBeenCalledTimes(1)
    unmount()

    jest.clearAllMocks()

    // Per-mount override back to true: edge zone + the dismiss handle.
    render(<DrawerProvider content={<span>content</span>} dismissible />)
    expect(MockGestureDetector).toHaveBeenCalledTimes(2)
  })

  it('blockingBackdrop: settable at the factory level and overridden per-mount', () => {
    const { DrawerProvider, useDrawer } = createDrawer({ blockingBackdrop: false })

    const { unmount } = render(
      <DrawerProvider content={<span>content</span>}>
        <OpenableConsumer useHook={useDrawer} />
      </DrawerProvider>
    )
    fireEvent.click(screen.getByText('open'))
    expect(backdropPointerEvents()).toBe('none')
    unmount()

    jest.clearAllMocks()

    render(
      <DrawerProvider blockingBackdrop content={<span>content</span>}>
        <OpenableConsumer useHook={useDrawer} />
      </DrawerProvider>
    )
    fireEvent.click(screen.getByText('open'))
    expect(backdropPointerEvents()).toBe('auto')
  })

  it('backdropOpacity: settable at the factory level and overridden per-mount', () => {
    const { DrawerProvider, useDrawer } = createDrawer({ backdropOpacity: 0.2 })

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
      <DrawerProvider content={<span>content</span>}>
        <Consumer />
      </DrawerProvider>
    )
    fireEvent.click(screen.getByText('open'))
    // The open click's own render can't yet reflect its own not-yet-run spring effect (a SharedValue
    // mutation, unlike setState, triggers no further render here) — closing immediately after
    // captures the *preceding* render's now-settled (fully open) translateOffset, one step behind,
    // before its own close effect has had a chance to run.
    fireEvent.click(screen.getByText('close'))
    expect(backdropOpacityValue()).toBeCloseTo(0.2)
    unmount()

    jest.clearAllMocks()

    render(
      <DrawerProvider backdropOpacity={0.45} content={<span>content</span>}>
        <Consumer />
      </DrawerProvider>
    )
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByText('close'))
    expect(backdropOpacityValue()).toBeCloseTo(0.45)
  })

  it('showHandle: settable at the factory level and overridden per-mount', () => {
    const { DrawerProvider } = createDrawer({ showHandle: false })

    // Factory default false: both the edge-swipe zone and the dismiss handle's own strip still
    // render (dismissible defaults true, independent of showHandle) — just without the pill graphic.
    const { unmount } = render(<DrawerProvider content={<span>content</span>} />)
    expect(pillRendered()).toBe(false)
    expect(MockGestureDetector).toHaveBeenCalledTimes(2)
    unmount()

    jest.clearAllMocks()

    // Per-mount override back to true: pill graphic returns.
    render(<DrawerProvider content={<span>content</span>} showHandle />)
    expect(pillRendered()).toBe(true)
  })

  it('contentSize: settable at the factory level and overridden per-mount', () => {
    const { DrawerProvider } = createDrawer({ contentSize: true })

    // Factory default true: the content wrapper gets onLayout wired up for measurement.
    const { unmount } = render(<DrawerProvider content={<span>content</span>} />)
    expect(MockView.mock.calls.some((call) => typeof call[0].onLayout === 'function')).toBe(true)
    unmount()

    jest.clearAllMocks()

    // Per-mount override back to false: no onLayout wiring, fixed-size behavior.
    render(<DrawerProvider content={<span>content</span>} contentSize={false} />)
    expect(MockView.mock.calls.some((call) => typeof call[0].onLayout === 'function')).toBe(false)
  })

  describe('zIndex', () => {
    // Positional, not by their own zIndex (that's what's under test) — the Drawer this
    // DrawerProvider renders always produces its backdrop as the first Animated.View call and its
    // panel as the second, and nothing else in these tests renders an Animated.View before it.
    const backdropZIndex = () => flattenStyle(MockAnimatedView.mock.calls[0][0].style).zIndex
    const panelZIndex = () => flattenStyle(MockAnimatedView.mock.calls[1][0].style).zIndex

    it('settable at the factory level and overridden per-mount', () => {
      const { DrawerProvider } = createDrawer({ zIndex: 100 })

      const { unmount } = render(<DrawerProvider content={<span>content</span>} />)
      expect(backdropZIndex()).toBe(100)
      expect(panelZIndex()).toBe(101)
      unmount()

      jest.clearAllMocks()

      render(<DrawerProvider content={<span>content</span>} zIndex={200} />)
      expect(backdropZIndex()).toBe(200)
      expect(panelZIndex()).toBe(201)
    })

    // The bug this option exists to fix: two createDrawer() instances that can be open at the same
    // time (e.g. in a screen with both a nav drawer and a confirmation sheet) previously had no way
    // to control which one visually stacks on top — plain View zIndex ties break on render order,
    // which combineDrawerProviders/manual nesting fixes independently of which drawer actually makes
    // sense to show on top for a given screen.
    it('lets two simultaneously-open drawers have an explicit, unambiguous stacking order regardless of nesting order', () => {
      const back = createDrawer({ side: 'left', zIndex: 50 })
      const front = createDrawer({ side: 'bottom', zIndex: 100 })

      // `back` is declared outermost — under the old hardcoded zIndex, whichever provider rendered
      // its own Drawer last (here, `back`, since a JSX parent's own trailing elements render after
      // the `children` it wraps) would win the stacking tie regardless of which one this is.
      render(
        <back.DrawerProvider content={<span>back content</span>}>
          <front.DrawerProvider content={<span>front content</span>} />
        </back.DrawerProvider>
      )

      const zIndexes = MockAnimatedView.mock.calls.map((call) => flattenStyle(call[0].style).zIndex).filter((value): value is number => typeof value === 'number')

      // Each Drawer renders exactly one backdrop + one panel Animated.View.
      expect(zIndexes).toHaveLength(4)
      // `front`'s entire backdrop+panel stack sits strictly above all of `back`'s — the configured
      // zIndex wins, not declaration order.
      expect(Math.min(...zIndexes.filter((value) => value >= 100))).toBeGreaterThan(Math.max(...zIndexes.filter((value) => value < 100)))
    })
  })
})
