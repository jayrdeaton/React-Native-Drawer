import { Pressable } from '@rific/haptic-press'
import { ComponentType, ReactNode, useEffect, useState } from 'react'
import { LayoutChangeEvent, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useTheme } from 'react-native-paper'
import Animated, { runOnJS, SharedValue, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'

import { type DrawerSide, getClosedOffset, getOpenDirection, isVerticalSide } from './geometry'

const SPRING = { damping: 40, stiffness: 300, overshootClamping: true }
const VELOCITY_THRESHOLD = 500

// Minimal local shape of @rific/auto-paper covering only the members used below — avoids forcing
// TypeScript to resolve the optional peer's real types for consumers who never installed it.
interface AutoPaperModule {
  BlurView: ComponentType<{ children?: ReactNode; onLayout?: (event: LayoutChangeEvent) => void; style?: StyleProp<ViewStyle> }>
  useBlur: (override?: boolean) => boolean
}

// @rific/auto-paper is an optional peer — when absent, the panel falls back to a solid fill.
const AutoPaper = (() => {
  try {
    return require('@rific/auto-paper') as AutoPaperModule
  } catch {
    return null
  }
})()

// useBlur is a hook and must be called unconditionally on every render (rules of hooks) — this
// fallback stands in when @rific/auto-paper isn't installed, so a per-render branch isn't needed.
const useBlurFallback = (override?: boolean) => override ?? false
const useBlurHook = AutoPaper?.useBlur ?? useBlurFallback

export type DrawerProps = {
  // Peak backdrop opacity once fully open (scaled down as the panel slides toward closed, same as
  // before) — 0 renders no dimming at all, letting whatever's behind the panel stay fully visible.
  // Independent of blockingBackdrop: a panel can stay undimmed and still block touches, or vice versa.
  backdropOpacity?: number
  // Backdrop still dims/blurs identically either way; this only controls whether it intercepts
  // touches. false lets siblings behind/around the panel stay reachable while open.
  blockingBackdrop?: boolean
  blur?: boolean
  // Renders edge-to-edge behind the status bar/notch/home indicator, deliberately — pad your own
  // content with useSafeAreaInsets() (or a safe-area-aware header like @rific/scroll-view's) rather
  // than have this component impose a strategy that might double up with one you're already using.
  children?: ReactNode
  // When true, the panel sizes itself to its content's natural size along the main axis instead of
  // the fixed height/width below, and animates smoothly as that natural size changes. height/width
  // remain the pre-measurement placeholder (used until the first layout is measured).
  contentSize?: boolean
  // Renders a drag handle that can be swiped to close the panel, independent of the backdrop.
  dismissible?: boolean
  height?: number
  onClose: () => void
  // Fires once the close animation actually finishes settling at closedOffset — not when `open`
  // merely flips to false, which happens the instant something asks to close, well before the panel
  // has visually finished sliding away. Lets a parent (e.g. DrawerProvider's isVisible) track "still
  // on screen, mid-outro" as distinct from "asked to close," for anything that needs to stay above
  // the panel for the full duration it's visible rather than disappearing the moment closing starts.
  onClosed?: () => void
  // Fires whenever the content wrapper's natural size is (re)measured — lets a parent (e.g.
  // DrawerProvider) mirror the live size for its own math (DrawerEdgeSwipe's commit threshold).
  onMeasure?: (size: number) => void
  // Fires once the open animation actually finishes settling at 0 — the open-direction mirror of
  // onClosed above. Not consumed internally by DrawerProvider (isVisible only needs the outro side),
  // but useful for anything that should wait until the panel has visually finished sliding in, e.g.
  // autofocusing a field inside `content` only once it's actually on screen.
  onOpened?: () => void
  open: boolean
  side?: DrawerSide
  // Whether the handle strip's own visual pill graphic draws — independent of `dismissible`, which
  // controls the strip (and its drag-to-dismiss gesture) as a whole. false keeps the strip's hit area
  // (and the gesture attached to it) exactly as before; only the pill itself stops rendering. There's
  // no way to hide the strip's *gesture* while keeping the pill visible — an invisible-but-still-
  // grabbable strip would be a hidden trap for stray touches, not a real use case.
  showHandle?: boolean
  translateOffset?: SharedValue<number>
  width?: number
  // Stacking tier for this panel's backdrop/panel/handle, for apps that may have more than one Drawer
  // open at once (e.g. two separate createDrawer() instances). Plain View z-index ties break on
  // render/mount order, which for nested DrawerProviders is fixed by however they happen to be
  // declared/nested — not necessarily the order that makes sense on screen. The backdrop uses this
  // value directly; the panel and its drag handle use zIndex + 1 / + 2, preserving their relative
  // order within the panel itself. Give a simultaneously-open drawer that should stack on top a
  // higher value than the one(s) underneath it.
  zIndex?: number
}

export const Drawer = ({ backdropOpacity = 0.45, blockingBackdrop = true, blur, children, contentSize = false, dismissible = true, height = 300, onClose, onClosed, onMeasure, onOpened, open, side = 'left', showHandle = true, translateOffset: externalTranslateOffset, width = 300, zIndex = 50 }: DrawerProps) => {
  const { colors } = useTheme()
  const vertical = isVerticalSide(side)
  const size = vertical ? height : width
  const openDirection = getOpenDirection(side)
  const closeDirection = -openDirection as 1 | -1

  const [measuredSize, setMeasuredSize] = useState<number | null>(null)
  const effectiveSize = contentSize ? (measuredSize ?? size) : size

  const closedOffset = getClosedOffset(side, effectiveSize)
  const internalTranslateOffset = useSharedValue(closedOffset)
  const translateOffset = externalTranslateOffset ?? internalTranslateOffset
  const resolvedBlur = useBlurHook(blur)

  // The container's own animated size, eased toward effectiveSize whenever it changes (content-driven
  // sizing only). Kept as a shared value — like translateOffset — rather than driven inline inside
  // useAnimatedStyle, so it only restarts its transition when effectiveSize actually changes.
  const animatedSize = useSharedValue(effectiveSize)

  useEffect(() => {
    if (open) {
      translateOffset.value = withSpring(0, SPRING, (finished) => {
        if (finished && onOpened) runOnJS(onOpened)()
      })
      return
    }
    translateOffset.value = withSpring(closedOffset, SPRING, (finished) => {
      if (finished && onClosed) runOnJS(onClosed)()
    })
    // onOpened/onClosed deliberately excluded — both are plain closures (DrawerProvider passes a
    // fresh function every render), and including them would restart this spring from its current
    // position every time the parent re-renders for any unrelated reason.
  }, [open, closedOffset, translateOffset])

  useEffect(() => {
    if (contentSize) {
      animatedSize.value = withTiming(effectiveSize)
    }
  }, [contentSize, effectiveSize, animatedSize])

  const drawerStyle = useAnimatedStyle(() => ({ transform: [vertical ? { translateY: translateOffset.value } : { translateX: translateOffset.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: (1 - Math.abs(translateOffset.value) / effectiveSize) * backdropOpacity }))
  const animatedSizeStyle = useAnimatedStyle(() => (vertical ? { height: animatedSize.value } : { width: animatedSize.value }))

  const positionStyle = side === 'left' ? styles.anchorLeft : side === 'right' ? styles.anchorRight : side === 'top' ? styles.anchorTop : styles.anchorBottom
  const sizeStyle = vertical ? { height } : { width }

  const handleLayout = (event: LayoutChangeEvent) => {
    const measured = vertical ? event.nativeEvent.layout.height : event.nativeEvent.layout.width
    setMeasuredSize(measured)
    onMeasure?.(measured)
  }

  // contentSize=false: the inner wrapper fills the outer's fixed bounds exactly as before (untouched
  // path). contentSize=true: the background and the content-measuring wrapper have to be two separate
  // views. The wrapper must render at its OWN natural size, unconstrained by the outer's (animated)
  // bounds — using absoluteFill on it would stretch it to match the outer, making onLayout report the
  // container's current size back to itself instead of the content's true size. But the outer's clip
  // window only catches up to a new size gradually (see the animatedSize effect above), so on any
  // frame where content is smaller than the still-large outer, a background sized to CONTENT instead
  // of the outer leaves a gap below it — whatever's behind the drawer shows through until the outer
  // finishes shrinking. So the background is its own absoluteFill sibling, always exactly the outer's
  // current (possibly mid-animation) size, and only the wrapper is sized/measured naturally — the same
  // structure as a CSS accordion expand/collapse either way.
  const fillStyle: StyleProp<ViewStyle> = StyleSheet.absoluteFill

  const fill =
    resolvedBlur && AutoPaper?.BlurView ? (
      contentSize ? (
        <>
          <AutoPaper.BlurView style={fillStyle} />
          <View onLayout={handleLayout}>{children}</View>
        </>
      ) : (
        <AutoPaper.BlurView style={fillStyle}>{children}</AutoPaper.BlurView>
      )
    ) : contentSize ? (
      <>
        <View style={[fillStyle, { backgroundColor: colors.surface }]} />
        <View onLayout={handleLayout}>{children}</View>
      </>
    ) : (
      <View style={[fillStyle, { backgroundColor: colors.surface }]}>{children}</View>
    )

  const drawerOuterStyle: StyleProp<ViewStyle> = contentSize ? [styles.drawer, positionStyle, styles.clip, { flexDirection: vertical ? 'column' : 'row' }, drawerStyle, animatedSizeStyle, { zIndex: zIndex + 1 }] : [styles.drawer, positionStyle, sizeStyle, drawerStyle, { zIndex: zIndex + 1 }]

  // Dismiss-by-drag handle: a strip pinned to the edge closest to the closed direction (the edge the
  // panel slides back toward), gesture-matched to `side` the same way DrawerEdgeSwipe is, just
  // mirrored — it starts from the OPEN position (0) and commits toward `closedOffset` instead of the
  // reverse. Deliberately its own hit area rather than the whole panel, so it can't steal touches from
  // arbitrary interactive content inside `children`.
  const clampMin = Math.min(0, closedOffset)
  const clampMax = Math.max(0, closedOffset)

  const handleAxisGesture = vertical
    ? Gesture.Pan()
        .activeOffsetY(closeDirection * 10)
        .failOffsetX([-15, 15])
    : Gesture.Pan()
        .activeOffsetX(closeDirection * 10)
        .failOffsetY([-15, 15])

  const handleGesture = handleAxisGesture
    .enabled(open)
    .onUpdate((event) => {
      'worklet'
      const translation = vertical ? event.translationY : event.translationX
      translateOffset.value = Math.min(clampMax, Math.max(clampMin, translation))
    })
    .onEnd((event) => {
      'worklet'
      const translation = vertical ? event.translationY : event.translationX
      const velocity = vertical ? event.velocityY : event.velocityX
      const commit = translation * closeDirection > effectiveSize / 3 || velocity * closeDirection > VELOCITY_THRESHOLD
      if (commit) {
        translateOffset.value = withSpring(closedOffset, SPRING)
        runOnJS(onClose)()
      } else {
        translateOffset.value = withSpring(0, SPRING)
      }
    })

  // The whole strip along the closed-direction edge is grabbable, flush against it — not just the
  // small pill drawn inside it — so there's nothing precise to aim for. The strip's own thickness
  // already reads as clearance from the rest of the panel's content, so there's no separate inset
  // spent on top of that for nothing.
  const HANDLE_STRIP_THICKNESS = 28
  const handleStripSizeStyle: ViewStyle = vertical ? { height: HANDLE_STRIP_THICKNESS, left: 0, right: 0 } : { bottom: 0, top: 0, width: HANDLE_STRIP_THICKNESS }
  const handleStripEdgeStyle: ViewStyle = side === 'bottom' ? { top: 0 } : side === 'top' ? { bottom: 0 } : side === 'left' ? { right: 0 } : { left: 0 }
  const handlePillStyle: ViewStyle = vertical ? { height: 6, width: 64 } : { height: 64, width: 6 }
  // react-native-web reads `cursor` straight off style; native ignores the unknown key. ViewStyle (the
  // native type these files are typed against) has no such property, hence the cast.
  const webCursorStyle = { cursor: Platform.OS === 'web' ? 'pointer' : undefined } as ViewStyle

  return (
    <>
      <Animated.View style={[styles.backdrop, { zIndex }, backdropStyle]} pointerEvents={open && blockingBackdrop ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={drawerOuterStyle}>
        {fill}
        {dismissible && (
          <GestureDetector gesture={handleGesture}>
            <View style={[styles.handleStrip, handleStripSizeStyle, handleStripEdgeStyle, webCursorStyle, { zIndex: zIndex + 2 }]}>{showHandle && <View style={[styles.handlePill, handlePillStyle, { backgroundColor: colors.onSurfaceVariant }]} />}</View>
          </GestureDetector>
        )}
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  anchorBottom: {
    bottom: 0,
    left: 0,
    right: 0
  },
  anchorLeft: {
    bottom: 0,
    left: 0,
    top: 0
  },
  anchorRight: {
    bottom: 0,
    right: 0,
    top: 0
  },
  anchorTop: {
    left: 0,
    right: 0,
    top: 0
  },
  backdrop: {
    backgroundColor: '#000',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  clip: {
    overflow: 'hidden'
  },
  drawer: {
    position: 'absolute'
  },
  handlePill: {
    borderRadius: 3,
    opacity: 0.5
  },
  handleStrip: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute'
  }
})
