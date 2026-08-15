import { Platform, StyleSheet, View, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS, SharedValue, withSpring } from 'react-native-reanimated'

import { type DrawerDimension, type DrawerSide, getOpenDirection, isVerticalSide } from './geometry'
import { useDrawerSize } from './useDrawerSize'

const EDGE_WIDTH = 24
// Kept identical to Drawer.tsx's own SPRING (see its comment for the reasoning) so an
// edge-swipe-opened drawer settles at the same rate as a tap-opened one.
const SPRING = { damping: 45, overshootClamping: true, stiffness: 500, restDisplacementThreshold: 0.5, restSpeedThreshold: 10 }
const VELOCITY_THRESHOLD = 500

export type DrawerEdgeSwipeProps = {
  // Mirrors Drawer's own edgeInset: keep both in sync (same value) so this gesture's clamp/rest
  // math agrees with the panel it's driving. See Drawer's own doc comment for the full rationale
  // (in short: shrinks the basis a *percentage* height/maxHeight/width/maxWidth resolves against; a
  // literal px number is unaffected).
  edgeInset?: number
  enabled?: boolean
  height?: DrawerDimension
  // Mirrors Drawer's own maxHeight: when set, an edge swipe still only opens to `height` (the rest
  // size), not all the way to this ceiling — matching Drawer's tap-to-open behavior, which also
  // lands at rest. Reaching past rest, up to maxHeight, is only ever done via Drawer's own handle.
  maxHeight?: DrawerDimension
  // The maxWidth mirror of maxHeight, for `left`/`right` drawers.
  maxWidth?: DrawerDimension
  onOpen: () => void
  side?: DrawerSide
  translateOffset: SharedValue<number>
  width?: DrawerDimension
}

export const DrawerEdgeSwipe = ({ edgeInset = 0, enabled = true, height = 300, maxHeight, maxWidth, onOpen, side = 'left', translateOffset, width = 300 }: DrawerEdgeSwipeProps) => {
  const vertical = isVerticalSide(side)
  const { closedOffset, effectiveSize, restOffset } = useDrawerSize(side, vertical ? height : width, vertical ? maxHeight : maxWidth, edgeInset)
  const openDirection = getOpenDirection(side)
  const clampMin = Math.min(0, closedOffset)
  const clampMax = Math.max(0, closedOffset)

  const axisGesture = vertical
    ? Gesture.Pan()
        .activeOffsetY(side === 'top' ? 10 : -10)
        .failOffsetX([-15, 15])
    : Gesture.Pan()
        .activeOffsetX(side === 'left' ? 10 : -10)
        .failOffsetY([-15, 15])

  const gesture = axisGesture
    .enabled(enabled)
    .onUpdate((event) => {
      'worklet'
      const translation = vertical ? event.translationY : event.translationX
      translateOffset.value = Math.min(clampMax, Math.max(clampMin, closedOffset + translation))
    })
    .onEnd((event) => {
      'worklet'
      const translation = vertical ? event.translationY : event.translationX
      const velocity = vertical ? event.velocityY : event.velocityX
      const commit = translation * openDirection > effectiveSize / 3 || velocity * openDirection > VELOCITY_THRESHOLD
      if (commit) {
        translateOffset.value = withSpring(restOffset, SPRING)
        runOnJS(onOpen)()
      } else {
        translateOffset.value = withSpring(closedOffset, SPRING)
      }
    })

  const edgeStyle = vertical ? [styles.edgeHorizontal, side === 'top' ? styles.top : styles.bottom] : [styles.edgeVertical, side === 'left' ? styles.left : styles.right]

  return (
    <GestureDetector gesture={gesture}>
      {/* Same web-only affordance Drawer.tsx's own handle strip gives its drag grip (see its
          webCursorStyle) — without it, nothing on screen hints that this edge is draggable at
          all on a platform with a mouse cursor to change in the first place.

          pointerEvents here (not just gesture.enabled(enabled) above) matters on web specifically:
          RNGH's own enabled() only stops the Pan gesture from recognizing/completing a touch, it
          doesn't stop this View's underlying DOM node from being hit-tested. Without this, a caller
          passing enabled={false} to shed the edge-swipe-to-open behavior (e.g. because their own
          screen never uses it) still ends up with this zone as an invisible, unconditionally opaque
          strip along the edge — silently swallowing presses meant for anything else placed there,
          even though the gesture it exists for no longer does anything. 'none' when disabled lets
          that click/tap fall straight through to whatever's actually underneath. */}
      <View style={[...edgeStyle, webCursorStyle, enabled ? styles.interactive : styles.nonInteractive]} />
    </GestureDetector>
  )
}

// react-native-web reads `cursor` straight off style; native ignores the unknown key. ViewStyle
// (the native type this file is typed against) has no such property, hence the cast.
const webCursorStyle = { cursor: Platform.OS === 'web' ? 'pointer' : undefined } as ViewStyle

const styles = StyleSheet.create({
  bottom: { bottom: 0 },
  edgeHorizontal: {
    height: EDGE_WIDTH,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 5
  },
  edgeVertical: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: EDGE_WIDTH,
    zIndex: 5
  },
  // See enabled's own comment above for why this needs to be a real style toggle, not just the
  // gesture's own .enabled(enabled).
  interactive: { pointerEvents: 'auto' },
  left: { left: 0 },
  nonInteractive: { pointerEvents: 'none' },
  right: { right: 0 },
  top: { top: 0 }
})
