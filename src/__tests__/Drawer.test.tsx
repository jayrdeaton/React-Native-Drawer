import { BlurView, useBlur } from '@rific/auto-paper'
import { act, render, type RenderResult, screen } from '@testing-library/react'
import React, { type ReactElement } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, { type SharedValue, withSpring } from 'react-native-reanimated'

import { type AutoPaperModule, DrawerProvider } from '../DrawerConfig'
import { Drawer } from '../Drawer'

const MockBlurView = BlurView as unknown as jest.Mock
const mockUseBlur = useBlur as unknown as jest.Mock
const MockUseWindowDimensions = useWindowDimensions as unknown as jest.Mock
const MockView = View as unknown as jest.Mock
const MockGestureDetector = GestureDetector as unknown as jest.Mock
const MockAnimatedView = Animated.View as unknown as jest.Mock
const MockWithSpring = withSpring as unknown as jest.Mock

// @rific/auto-paper is configured via configureDrawer()/<DrawerProvider>, not
// auto-detected. Every render() call site in this file goes through this wrapper so
// BlurView/useBlur are the mocks above (`import { BlurView, useBlur } from '@rific/auto-paper'`
// resolves to the manual mock via jest.config.cjs's moduleNameMapper), matching what an app
// that configured the real module would see.
const mockAutoPaper: AutoPaperModule = { BlurView, useBlur }
const withAutoPaper = ({ children }: { children: React.ReactNode }) => <DrawerProvider autoPaper={mockAutoPaper}>{children}</DrawerProvider>
const renderDrawer = (ui: ReactElement): RenderResult => render(ui, { wrapper: withAutoPaper })

// withSpring's 3rd arg is the finished-callback, passed on both the open and close paths (onOpened
// and onClosed respectively); grabs the most recent one so a test can simulate that spring settling,
// same idea as lastGesture() below.
const lastSpringFinishCallback = () => [...MockWithSpring.mock.calls].reverse().find((call) => typeof call[2] === 'function')?.[2] as ((finished?: boolean) => void) | undefined

type MockedGesture = { __getHandlers: () => { enabled: boolean; onEnd?: (event: { translationX: number; translationY: number; velocityX: number; velocityY: number }) => void; onStart?: () => void; onUpdate?: (event: { translationX: number; translationY: number; velocityX: number; velocityY: number }) => void } }
type MockedTapGesture = { __getHandlers: () => { enabled: boolean; onEnd?: (event: Record<string, never>, success: boolean) => void } }

// Drawer always renders its backdrop's own Gesture.Tap() first (the very first GestureDetector in
// the tree — see the zIndex describe block's own comment on render order) and the drag handle's
// Gesture.Pan() last, if it renders at all (dismissible) — same reasoning as lastGesture below, just
// anchored to the opposite end of the call list.
const firstGesture = () => (MockGestureDetector.mock.calls[0][0].gesture as MockedTapGesture).__getHandlers()
const lastGesture = () => (MockGestureDetector.mock.calls[MockGestureDetector.mock.calls.length - 1][0].gesture as MockedGesture).__getHandlers()
const event = (translationX: number, velocityX: number) => ({ translationX, translationY: 0, velocityX, velocityY: 0 })
const sharedValue = (initial: number) => ({ value: initial }) as SharedValue<number>

const flattenStyle = (style: unknown): Record<string, unknown> => (Array.isArray(style) ? style : [style]).reduce((acc: Record<string, unknown>, s) => ({ ...acc, ...(s as Record<string, unknown>) }), {})

const drawerPanelStyle = (zIndex = 50) => flattenStyle(MockAnimatedView.mock.calls.find((call) => flattenStyle(call[0].style).zIndex === zIndex + 1)?.[0].style)
// The backdrop's own outer wrapper — carries zIndex and pointerEvents (both inside style now, not
// pointerEvents as a bare prop — see Drawer.tsx's own comment on why), but no longer opacity, which
// moved to its child backdropTint (see backdropTintCall below) once the dimming layer and the
// tap-to-close hit target split into separate views.
const backdropCall = () => MockAnimatedView.mock.calls.find((call) => flattenStyle(call[0].style).zIndex === 50)?.[0]
// The backdrop's dimming child — identified by its distinctive backgroundColor (styles.backdropTint)
// rather than zIndex, which it doesn't set at all (it inherits its stacking from the outer wrapper).
const backdropTintCall = () => MockAnimatedView.mock.calls.find((call) => flattenStyle(call[0].style).backgroundColor === '#000')?.[0]
// The handle strip is an Animated.View, identified by its distinctive alignItems/justifyContent
// styling (styles.handleStrip) rather than position or zIndex, both of which vary by test.
const handleStripStyle = () => flattenStyle(MockAnimatedView.mock.calls.find((call) => flattenStyle(call[0].style).justifyContent === 'center')?.[0].style)
// panelShadow's own Animated.View, identified by the one style property nothing else in Drawer
// ever sets — a boxShadow array — rather than position/zIndex, both of which vary by test.
const panelShadowStyle = () => flattenStyle(MockAnimatedView.mock.calls.find((call) => Array.isArray(flattenStyle(call[0].style).boxShadow))?.[0]?.style)

describe('Drawer', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls onClose when the backdrop is pressed', () => {
    const onClose = jest.fn()
    renderDrawer(<Drawer onClose={onClose} open />)

    // success=true: a genuine completed tap, as opposed to one that got interrupted or dragged past
    // the gesture's own distance/duration bounds (see Drawer.tsx's backdropTapGesture — only a
    // successful tap actually calls onClose).
    firstGesture().onEnd?.({}, true)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when the backdrop tap gesture reports failure', () => {
    const onClose = jest.fn()
    renderDrawer(<Drawer onClose={onClose} open />)

    firstGesture().onEnd?.({}, false)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders its content', () => {
    renderDrawer(
      <Drawer onClose={jest.fn()} open>
        <span>drawer content</span>
      </Drawer>
    )

    expect(screen.getByText('drawer content')).toBeTruthy()
  })

  it('renders the panel via BlurView when blur resolves true', () => {
    mockUseBlur.mockReturnValueOnce(true)

    renderDrawer(
      <Drawer blur onClose={jest.fn()} open>
        <span>drawer content</span>
      </Drawer>
    )

    expect(MockBlurView).toHaveBeenCalled()
    expect(screen.getByText('drawer content')).toBeTruthy()
  })

  it('falls back to a plain solid background when blur resolves false', () => {
    mockUseBlur.mockReturnValueOnce(false)

    renderDrawer(
      <Drawer blur={false} onClose={jest.fn()} open>
        <span>drawer content</span>
      </Drawer>
    )

    expect(MockBlurView).not.toHaveBeenCalled()
    expect(screen.getByText('drawer content')).toBeTruthy()
  })

  it('passes blur through to useBlur() unmodified when omitted, deferring to its own global preference', () => {
    renderDrawer(
      <Drawer onClose={jest.fn()} open>
        <span>drawer content</span>
      </Drawer>
    )

    expect(mockUseBlur).toHaveBeenCalledWith(undefined)
  })

  describe('onClosed', () => {
    it('fires once the close animation reports it has actually finished', () => {
      const onClosed = jest.fn()
      const { rerender } = renderDrawer(
        <Drawer onClose={jest.fn()} onClosed={onClosed} open>
          <span>drawer content</span>
        </Drawer>
      )

      rerender(
        <Drawer onClose={jest.fn()} onClosed={onClosed} open={false}>
          <span>drawer content</span>
        </Drawer>
      )

      // open flipping to false alone must not fire it; only the spring settling does.
      expect(onClosed).not.toHaveBeenCalled()

      act(() => lastSpringFinishCallback()?.(true))

      expect(onClosed).toHaveBeenCalledTimes(1)
    })

    it('does not fire when the close animation is interrupted instead of settling', () => {
      const onClosed = jest.fn()
      const { rerender } = renderDrawer(
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

    it('is safe to omit: a finishing close animation never throws without a handler', () => {
      const { rerender } = renderDrawer(
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
      renderDrawer(
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
      renderDrawer(
        <Drawer onClose={jest.fn()} onOpened={onOpened} open>
          <span>drawer content</span>
        </Drawer>
      )

      act(() => lastSpringFinishCallback()?.(false))

      expect(onOpened).not.toHaveBeenCalled()
    })

    it('is independent of onClosed: each only fires for its own direction', () => {
      const onOpened = jest.fn()
      const onClosed = jest.fn()
      const { rerender } = renderDrawer(
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

    it('is safe to omit: a finishing open animation never throws without a handler', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(() => act(() => lastSpringFinishCallback()?.(true))).not.toThrow()
    })
  })

  describe('contentSize', () => {
    it('defaults to false and leaves fixed-size behavior completely unchanged', () => {
      renderDrawer(
        <Drawer height={250} onClose={jest.fn()} open side='bottom'>
          <span>drawer content</span>
        </Drawer>
      )

      // No onLayout wiring on the content wrapper when contentSize is off.
      const contentCall = MockView.mock.calls.find((call) => typeof call[0].onLayout === 'function')
      expect(contentCall).toBeUndefined()

      // The panel keeps its plain, non-animated fixed height style: no clipping, no flex axis.
      const style = drawerPanelStyle()
      expect(style.height).toBe(250)
      expect(style.overflow).toBeUndefined()
      expect(style.flexDirection).toBeUndefined()
    })

    it('measuring the content wrapper updates the measured size, reports it via onMeasure, and flows into the closed-offset math', () => {
      const onMeasure = jest.fn()
      const translateOffset = sharedValue(0)

      renderDrawer(
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

    it('measures width instead of height for a horizontal (left/right) drawer: contentSize is not height-specific', () => {
      const onMeasure = jest.fn()
      const translateOffset = sharedValue(0)

      renderDrawer(
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

  describe('percentage sizing', () => {
    // The react-native mock's useWindowDimensions returns a fixed { height: 800, width: 400 }.
    it('resolves a percentage height against the window height', () => {
      renderDrawer(
        <Drawer height='50%' onClose={jest.fn()} open side='bottom'>
          <span>drawer content</span>
        </Drawer>
      )

      expect(drawerPanelStyle().height).toBe(400)
    })

    it('resolves a percentage width against the window width', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open width='25%'>
          <span>drawer content</span>
        </Drawer>
      )

      expect(drawerPanelStyle().width).toBe(100)
    })

    it('leaves a plain number completely unaffected', () => {
      renderDrawer(
        <Drawer height={250} onClose={jest.fn()} open side='top'>
          <span>drawer content</span>
        </Drawer>
      )

      expect(drawerPanelStyle().height).toBe(250)
    })

    // Regression: a 0x0 window (e.g. web, briefly, before the real size is measured on mount) used
    // to resolve a percentage size to 0, and 0 as the backdrop opacity denominator produced NaN
    // (0/0) rather than a clean 0 — react-native-web throws on an NaN style value.
    it('never produces a NaN backdrop opacity when the window is briefly 0x0', () => {
      MockUseWindowDimensions.mockReturnValueOnce({ fontScale: 1, height: 0, scale: 1, width: 0 })

      renderDrawer(
        <Drawer height='50%' maxHeight='100%' onClose={jest.fn()} open side='bottom' translateOffset={sharedValue(0)}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(flattenStyle(backdropTintCall()?.style).opacity).toBe(0)
    })
  })

  describe('maxHeight/maxWidth (expandable sheets)', () => {
    const verticalEvent = (translationY: number, velocityY: number) => ({ translationX: 0, translationY, velocityX: 0, velocityY })

    it('rests at less than maxHeight when open, revealing only height px', () => {
      const translateOffset = sharedValue(800)
      renderDrawer(
        <Drawer height={300} maxHeight={800} onClose={jest.fn()} open side='bottom' translateOffset={translateOffset}>
          <span>drawer content</span>
        </Drawer>
      )

      // 800 (closed) - 300 (rest, i.e. height px visible) = 500: the panel sits mostly off-screen
      // below, at rest, rather than jumping straight to fully expanded (0).
      expect(translateOffset.value).toBe(500)
    })

    it('renders the panel at its maxHeight, not its rest height, so there is room to expand into', () => {
      renderDrawer(
        <Drawer height={300} maxHeight={800} onClose={jest.fn()} open side='bottom'>
          <span>drawer content</span>
        </Drawer>
      )

      expect(drawerPanelStyle().height).toBe(800)
    })

    it('expands to fully open when the handle is dragged past a third of the way from rest', () => {
      const onClose = jest.fn()
      const translateOffset = sharedValue(500)
      renderDrawer(
        <Drawer height={300} maxHeight={800} onClose={onClose} open side='bottom' translateOffset={translateOffset}>
          <span>drawer content</span>
        </Drawer>
      )

      const { onStart, onUpdate, onEnd } = lastGesture()
      onStart?.()
      // Dragging up (negative Y) 200 of the 500px rest-to-expanded segment: 40%, past a third.
      onUpdate?.(verticalEvent(-200, 0))
      expect(translateOffset.value).toBe(300)

      onEnd?.(verticalEvent(-200, 0))

      expect(translateOffset.value).toBe(0)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('springs back to rest, not fully open, when the expand drag is short and slow', () => {
      const onClose = jest.fn()
      const translateOffset = sharedValue(500)
      renderDrawer(
        <Drawer height={300} maxHeight={800} onClose={onClose} open side='bottom' translateOffset={translateOffset}>
          <span>drawer content</span>
        </Drawer>
      )

      const { onStart, onUpdate, onEnd } = lastGesture()
      onStart?.()
      onUpdate?.(verticalEvent(-50, 0))
      expect(translateOffset.value).toBe(450)

      onEnd?.(verticalEvent(-50, 0))

      expect(translateOffset.value).toBe(500)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('still closes when dragged past a third of the way from rest toward closed', () => {
      const onClose = jest.fn()
      const translateOffset = sharedValue(500)
      renderDrawer(
        <Drawer height={300} maxHeight={800} onClose={onClose} open side='bottom' translateOffset={translateOffset}>
          <span>drawer content</span>
        </Drawer>
      )

      const { onStart, onUpdate, onEnd } = lastGesture()
      onStart?.()
      // Dragging down 150 of the 300px rest-to-closed segment: 50%, past a third.
      onUpdate?.(verticalEvent(150, 0))
      expect(translateOffset.value).toBe(650)

      onEnd?.(verticalEvent(150, 0))

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(translateOffset.value).toBe(800)
    })

    it('has no effect when contentSize is true: sizing stays purely content-driven', () => {
      renderDrawer(
        <Drawer contentSize height={200} maxHeight={800} onClose={jest.fn()} open side='bottom'>
          <span>drawer content</span>
        </Drawer>
      )

      expect(drawerPanelStyle().height).toBe(200)
    })
  })

  describe('edgeInset', () => {
    const verticalEvent = (translationY: number, velocityY: number) => ({ translationX: 0, translationY, velocityX: 0, velocityY })

    it('has no effect when omitted: the panel can still reach the true screen edge', () => {
      renderDrawer(
        <Drawer height='50%' maxHeight='100%' onClose={jest.fn()} open side='bottom'>
          <span>drawer content</span>
        </Drawer>
      )

      // Mocked window is 800 tall: maxHeight 100% resolves to the full 800, unclamped.
      expect(drawerPanelStyle().height).toBe(800)
    })

    it('shrinks the basis a percentage maxHeight resolves against, capping it short of the far (top) edge', () => {
      renderDrawer(
        <Drawer edgeInset={50} height='50%' maxHeight='100%' onClose={jest.fn()} open side='bottom'>
          <span>drawer content</span>
        </Drawer>
      )

      // 800 (window) - 50 (edgeInset) = 750, not the full 800: `100%` fills exactly up to the inset.
      expect(drawerPanelStyle().height).toBe(750)
    })

    it('shrinks the basis a percentage height resolves against too, not just an expand ceiling', () => {
      renderDrawer(
        <Drawer edgeInset={50} height='100%' onClose={jest.fn()} open side='bottom'>
          <span>drawer content</span>
        </Drawer>
      )

      expect(drawerPanelStyle().height).toBe(750)
    })

    it('leaves a literal pixel maxHeight untouched: an exact size you asked for is not reinterpreted', () => {
      renderDrawer(
        <Drawer edgeInset={50} height={300} maxHeight={800} onClose={jest.fn()} open side='bottom'>
          <span>drawer content</span>
        </Drawer>
      )

      // Still 800, not 750: a plain number opts back out of edgeInset for this drawer.
      expect(drawerPanelStyle().height).toBe(800)
    })

    it('leaves a literal pixel height untouched too', () => {
      renderDrawer(
        <Drawer edgeInset={50} height={800} onClose={jest.fn()} open side='bottom'>
          <span>drawer content</span>
        </Drawer>
      )

      expect(drawerPanelStyle().height).toBe(800)
    })

    it('stops a full-expand drag at the percentage-resolved boundary, not the literal screen edge', () => {
      const translateOffset = sharedValue(375)
      renderDrawer(
        <Drawer edgeInset={50} height='50%' maxHeight='100%' onClose={jest.fn()} open side='bottom' translateOffset={translateOffset}>
          <span>drawer content</span>
        </Drawer>
      )

      // maxEffectiveSize resolves to 750 (100% of the 800 window - 50 inset), so fully expanded
      // (translateOffset 0) lands with the panel's top edge at y=50, not y=0.
      const { onStart, onUpdate, onEnd } = lastGesture()
      onStart?.()
      onUpdate?.(verticalEvent(-2000, 0))
      onEnd?.(verticalEvent(-2000, 0))

      expect(translateOffset.value).toBe(0)
      expect(drawerPanelStyle().height).toBe(750)
    })
  })

  describe('dismissible', () => {
    it('renders a drag handle by default', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      // 2, not 1: the backdrop's own Gesture.Tap() (see the top-of-file comment on render order)
      // always renders regardless of dismissible, so the drag handle's Gesture.Pan() is the second.
      expect(MockGestureDetector).toHaveBeenCalledTimes(2)
    })

    it('omits the drag handle when dismissible is false', () => {
      renderDrawer(
        <Drawer dismissible={false} onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      // 1, not 0: the backdrop's own Gesture.Tap() still renders — dismissible only controls the
      // drag handle.
      expect(MockGestureDetector).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when the handle is dragged past a third of the size in the closing direction', () => {
      const onClose = jest.fn()
      const translateOffset = sharedValue(0)
      renderDrawer(
        <Drawer onClose={onClose} open translateOffset={translateOffset} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      const { onStart, onUpdate, onEnd } = lastGesture()
      onStart?.()
      onUpdate?.(event(-150, 0))
      expect(translateOffset.value).toBe(-150)

      onEnd?.(event(-150, 0))

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(translateOffset.value).toBe(-300)
    })

    it('calls onClose when the handle is dragged past a third of the height on the vertical axis for a top sheet', () => {
      const onClose = jest.fn()
      const translateOffset = sharedValue(0)
      renderDrawer(
        <Drawer height={300} onClose={onClose} open side='top' translateOffset={translateOffset}>
          <span>drawer content</span>
        </Drawer>
      )

      const verticalEvent = (translationY: number, velocityY: number) => ({ translationX: 0, translationY, velocityX: 0, velocityY })
      const { onStart, onUpdate, onEnd } = lastGesture()
      onStart?.()
      onUpdate?.(verticalEvent(-150, 0))
      expect(translateOffset.value).toBe(-150)

      onEnd?.(verticalEvent(-150, 0))

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(translateOffset.value).toBe(-300)
    })

    it('springs back open without calling onClose when the drag is short and slow', () => {
      const onClose = jest.fn()
      const translateOffset = sharedValue(0)
      renderDrawer(
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
      renderDrawer(
        <Drawer onClose={jest.fn()} open={false} translateOffset={translateOffset} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(lastGesture().enabled).toBe(false)
    })

    // Anchored via [oppositeSide]: -28 (see Drawer.tsx's handleStripEdgeStyle comment): the box's
    // far/backdrop-facing edge sits exactly 28px past the panel's own edge — the same spot the old
    // `[side]: '100%'` positioning landed it at — rather than flush *inside* the panel's own box,
    // eating into its content area.
    it('positions the handle outside the panel, past its content-facing edge, for every side', () => {
      const cases: Array<[side: 'bottom' | 'left' | 'right' | 'top', farEdge: string]> = [
        ['left', 'right'],
        ['right', 'left'],
        ['top', 'bottom'],
        ['bottom', 'top']
      ]

      for (const [side, farEdge] of cases) {
        const { unmount } = renderDrawer(
          <Drawer onClose={jest.fn()} open side={side}>
            <span>drawer content</span>
          </Drawer>
        )

        expect(handleStripStyle()[farEdge]).toBe(-28)

        unmount()
        jest.clearAllMocks()
      }
    })

    // The strip's own visual size is only 28px thick, but its actual box (and so its grabbable area)
    // is 48px — HANDLE_STRIP_TOTAL_THICKNESS — with the extra 20px (HANDLE_HIT_SLOP) landing on the
    // panel-facing side via padding, not on the backdrop-facing side, where it could swallow taps
    // meant for the backdrop's tap-to-dismiss.
    it('extends the grabbable box into the panel via padding on the panel-facing side, not the strip size', () => {
      const cases: Array<[side: 'bottom' | 'left' | 'right' | 'top', paddingProp: string, sizeProp: string]> = [
        ['left', 'paddingLeft', 'width'],
        ['right', 'paddingRight', 'width'],
        ['top', 'paddingTop', 'height'],
        ['bottom', 'paddingBottom', 'height']
      ]

      for (const [side, paddingProp, sizeProp] of cases) {
        const { unmount } = renderDrawer(
          <Drawer onClose={jest.fn()} open side={side}>
            <span>drawer content</span>
          </Drawer>
        )

        const style = handleStripStyle()
        expect(style[paddingProp]).toBe(20)
        expect(style[sizeProp]).toBe(48)

        unmount()
        jest.clearAllMocks()
      }
    })
  })

  describe('handle visibility', () => {
    // The handle floats outside the panel's own box (see the "positions the handle outside the
    // panel" test above), so the panel's own close translation — calibrated to hide exactly
    // maxEffectiveSize of panel — doesn't carry the handle's extra thickness off-screen with it.
    // Regression: without an explicit opacity cutoff, a closed drawer's handle ends up sitting
    // right at the screen edge, visibly stuck "open," forever.
    const handleOpacity = () => handleStripStyle().opacity

    it('is hidden once the panel is fully closed', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open={false} translateOffset={sharedValue(-300)} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(handleOpacity()).toBe(0)
    })

    it('is visible while open', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open translateOffset={sharedValue(0)} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(handleOpacity()).toBe(1)
    })

    it('hides once less than its own thickness (28px) of the panel remains visible while dragging closed', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open translateOffset={sharedValue(-280)} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      // 20px of the 300px-wide panel still visible: below the 28px handle thickness.
      expect(handleOpacity()).toBe(0)
    })

    it('stays visible right up until fewer than 28px of the panel remain', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open translateOffset={sharedValue(-272)} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      // 28px still visible: exactly at the threshold, still shown.
      expect(handleOpacity()).toBe(1)
    })

    it('stays hidden at rest for an expandable sheet whose rest size is itself under the handle thickness', () => {
      renderDrawer(
        <Drawer height={10} maxHeight={800} onClose={jest.fn()} open side='bottom' translateOffset={sharedValue(790)}>
          <span>drawer content</span>
        </Drawer>
      )

      // Rest only reveals 10px of an 800px-max sheet: nowhere near enough for the handle to sit
      // flush against a real edge.
      expect(handleOpacity()).toBe(0)
    })
  })

  describe('panelShadow', () => {
    it('renders nothing by default', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open translateOffset={sharedValue(0)} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(panelShadowStyle()).toEqual({})
    })

    it('uses sensible defaults (2px distance, 8px blur, 30% black) when passed true, with elevation mirroring blurRadius for Android', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open panelShadow translateOffset={sharedValue(0)} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(panelShadowStyle().boxShadow).toEqual([{ offsetX: 2, offsetY: 0, blurRadius: 8, color: 'rgba(0, 0, 0, 0.3)' }])
      expect(panelShadowStyle().elevation).toBe(8)
    })

    it('respects a custom distance/blurRadius/color, still mirroring the custom blurRadius into elevation', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open panelShadow={{ blurRadius: 16, color: '#123456', distance: 4 }} translateOffset={sharedValue(0)} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(panelShadowStyle().boxShadow).toEqual([{ offsetX: 4, offsetY: 0, blurRadius: 16, color: '#123456' }])
      expect(panelShadowStyle().elevation).toBe(16)
    })

    it('respects an explicit elevation independent of blurRadius', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open panelShadow={{ blurRadius: 16, elevation: 3 }} translateOffset={sharedValue(0)} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(panelShadowStyle().elevation).toBe(3)
    })

    // Regression: this is the whole reason panelShadow exists as an animated fade rather than a
    // plain static style — see Drawer.tsx's own doc comment on the prop for the bug this replaces.
    it('falls where the panel opens toward, not away from it, for every side', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open panelShadow side='left' translateOffset={sharedValue(0)} width={300}>
          <span>left</span>
        </Drawer>
      )
      expect(panelShadowStyle().boxShadow).toEqual([{ offsetX: 2, offsetY: 0, blurRadius: 8, color: 'rgba(0, 0, 0, 0.3)' }])

      jest.clearAllMocks()
      renderDrawer(
        <Drawer onClose={jest.fn()} open panelShadow side='right' translateOffset={sharedValue(0)} width={300}>
          <span>right</span>
        </Drawer>
      )
      expect(panelShadowStyle().boxShadow).toEqual([{ offsetX: -2, offsetY: 0, blurRadius: 8, color: 'rgba(0, 0, 0, 0.3)' }])

      jest.clearAllMocks()
      renderDrawer(
        <Drawer height={300} onClose={jest.fn()} open panelShadow side='top' translateOffset={sharedValue(0)}>
          <span>top</span>
        </Drawer>
      )
      expect(panelShadowStyle().boxShadow).toEqual([{ offsetX: 0, offsetY: 2, blurRadius: 8, color: 'rgba(0, 0, 0, 0.3)' }])

      jest.clearAllMocks()
      renderDrawer(
        <Drawer height={300} onClose={jest.fn()} open panelShadow side='bottom' translateOffset={sharedValue(0)}>
          <span>bottom</span>
        </Drawer>
      )
      expect(panelShadowStyle().boxShadow).toEqual([{ offsetX: 0, offsetY: -2, blurRadius: 8, color: 'rgba(0, 0, 0, 0.3)' }])
    })

    // The exact bug report this whole feature fixes: a plain static shadow bleeds its blurRadius
    // back onto the visible screen even while fully closed, since a closed panel sits exactly
    // flush against the screen edge (translateOffset === closedOffset) — opacity has to reach
    // all the way to 0 right at that point, not just "mostly faded."
    it('is fully invisible once the panel is fully closed', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open={false} panelShadow translateOffset={sharedValue(-300)} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(panelShadowStyle().opacity).toBe(0)
    })

    it('is fully visible while open', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open panelShadow translateOffset={sharedValue(0)} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(panelShadowStyle().opacity).toBe(1)
    })

    it('ramps smoothly across its own blurRadius + distance while dragging closed, unlike the handle strip\'s binary snap', () => {
      // blurRadius 8 + distance 2 = a 10px fade distance; 5px of panel still visible is exactly
      // half that.
      renderDrawer(
        <Drawer onClose={jest.fn()} open panelShadow translateOffset={sharedValue(-295)} width={300}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(panelShadowStyle().opacity).toBeCloseTo(0.5)
    })
  })

  describe('blockingBackdrop', () => {
    it('intercepts touches while open by default', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(flattenStyle(backdropCall()?.style).pointerEvents).toBe('auto')
    })

    it('never intercepts touches when blockingBackdrop is false, even while open', () => {
      renderDrawer(
        <Drawer blockingBackdrop={false} onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(flattenStyle(backdropCall()?.style).pointerEvents).toBe('none')
    })
  })

  describe('handle strip pointerEvents', () => {
    // handleVisibilityStyle's own opacity already fades the strip out once closed, but opacity
    // alone doesn't stop hit-testing on web/Android (see Drawer.tsx's own comment on the
    // iOS/opacity-0 asymmetry) — pointerEvents has to make that explicit itself, same as the
    // backdrop's own tap-catcher does for backdropTapGesture's identical open-gated .enabled().
    it('intercepts touches while open, matching handleGesture being enabled', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(handleStripStyle().pointerEvents).toBe('auto')
    })

    it('lets touches pass through while closed, matching handleGesture being disabled there too', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open={false}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(handleStripStyle().pointerEvents).toBe('none')
    })
  })

  describe('backdropOpacity', () => {
    // translateOffset is seeded to 0 (rather than relying on the open-triggered spring effect to
    // reach it) since that effect mutates a SharedValue ref directly, which, unlike setState,
    // triggers no further render here, so a style captured only from the initial render would still
    // reflect the pre-effect closedOffset instead. Seeding it directly makes the very first (and
    // only) render already reflect "fully open."
    it('dims to 0.45 while fully open by default', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open translateOffset={sharedValue(0)}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(flattenStyle(backdropTintCall()?.style).opacity).toBe(0.45)
    })

    it('renders no dimming at all when set to 0, independent of blockingBackdrop', () => {
      renderDrawer(
        <Drawer backdropOpacity={0} onClose={jest.fn()} open translateOffset={sharedValue(0)}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(flattenStyle(backdropTintCall()?.style).opacity).toBe(0)
      // Still blocks touches by default: an undimmed backdrop isn't the same as a non-blocking one.
      expect(flattenStyle(backdropCall()?.style).pointerEvents).toBe('auto')
    })
  })

  describe('showHandle', () => {
    const pillCall = () => MockView.mock.calls.find((call) => flattenStyle(call[0].style).borderRadius === 3)

    it('renders the grip pill by default', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(pillCall()).toBeDefined()
    })

    it('omits just the pill graphic when false, while keeping the strip (and its drag-to-dismiss gesture) intact', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open showHandle={false}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(pillCall()).toBeUndefined()
      // The strip itself, and the gesture attached to it, is unaffected by showHandle; only
      // `dismissible` controls whether either renders at all (see the dismissible tests above).
      // 2, not 1: the backdrop's own Gesture.Tap() always renders too (see the dismissible tests'
      // own comment on render order) — the handle's Gesture.Pan() is the second.
      expect(MockGestureDetector).toHaveBeenCalledTimes(2)
    })
  })

  describe('zIndex', () => {
    // The backdrop is located positionally (which is exactly what's under test here): Drawer always
    // renders it as the first Animated.View. The panel is no longer the second call now that
    // backdropTint and the collapsable backdrop-tap view render as additional Animated.View calls
    // ahead of it, so it's found via drawerPanelStyle() (by its own zIndex) instead. The handle strip
    // is itself an Animated.View too (for its own animated visibility), found by its distinctive
    // style rather than position.
    const handleStripCall = () => MockAnimatedView.mock.calls.find((call) => flattenStyle(call[0].style).justifyContent === 'center')

    it('defaults the backdrop/panel/handle to 50/51/52', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )

      expect(flattenStyle(MockAnimatedView.mock.calls[0][0].style).zIndex).toBe(50)
      expect(drawerPanelStyle().zIndex).toBe(51)
      expect(flattenStyle(handleStripCall()?.[0].style).zIndex).toBe(52)
    })

    it('shifts backdrop/panel/handle together, preserving their relative stacking, when set', () => {
      renderDrawer(
        <Drawer onClose={jest.fn()} open zIndex={200}>
          <span>drawer content</span>
        </Drawer>
      )

      expect(flattenStyle(MockAnimatedView.mock.calls[0][0].style).zIndex).toBe(200)
      expect(drawerPanelStyle(200).zIndex).toBe(201)
      expect(flattenStyle(handleStripCall()?.[0].style).zIndex).toBe(202)
    })
  })
})
