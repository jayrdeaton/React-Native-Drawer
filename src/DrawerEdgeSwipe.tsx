import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS, SharedValue, withSpring } from 'react-native-reanimated'

import { type DrawerSide, getClosedOffset, getOpenDirection, isVerticalSide } from './geometry'

const EDGE_WIDTH = 24
const SPRING = { damping: 40, overshootClamping: true, stiffness: 300 }
const VELOCITY_THRESHOLD = 500

export type DrawerEdgeSwipeProps = {
  enabled?: boolean
  height?: number
  onOpen: () => void
  side?: DrawerSide
  translateOffset: SharedValue<number>
  width?: number
}

export const DrawerEdgeSwipe = ({ enabled = true, height = 300, onOpen, side = 'left', translateOffset, width = 300 }: DrawerEdgeSwipeProps) => {
  const vertical = isVerticalSide(side)
  const size = vertical ? height : width
  const closedOffset = getClosedOffset(side, size)
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
      const commit = translation * openDirection > size / 3 || velocity * openDirection > VELOCITY_THRESHOLD
      if (commit) {
        translateOffset.value = withSpring(0, SPRING)
        runOnJS(onOpen)()
      } else {
        translateOffset.value = withSpring(closedOffset, SPRING)
      }
    })

  const edgeStyle = vertical ? [styles.edgeHorizontal, side === 'top' ? styles.top : styles.bottom] : [styles.edgeVertical, side === 'left' ? styles.left : styles.right]

  return (
    <GestureDetector gesture={gesture}>
      <View style={edgeStyle} />
    </GestureDetector>
  )
}

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
  left: { left: 0 },
  right: { right: 0 },
  top: { top: 0 }
})
