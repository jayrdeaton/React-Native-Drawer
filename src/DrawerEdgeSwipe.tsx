import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS, SharedValue, withSpring } from 'react-native-reanimated'

const EDGE_WIDTH = 24
const SPRING = { damping: 40, overshootClamping: true, stiffness: 300 }
const VELOCITY_THRESHOLD = 500

export type DrawerEdgeSwipeProps = {
  enabled?: boolean
  onOpen: () => void
  side?: 'left' | 'right'
  translateX: SharedValue<number>
  width: number
}

export const DrawerEdgeSwipe = ({ enabled = true, onOpen, side = 'left', translateX, width }: DrawerEdgeSwipeProps) => {
  const closedX = side === 'left' ? -width : width
  const openDirection = side === 'left' ? 1 : -1
  const clampMin = Math.min(0, closedX)
  const clampMax = Math.max(0, closedX)

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(side === 'left' ? 10 : -10)
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      translateX.value = Math.min(clampMax, Math.max(clampMin, closedX + event.translationX))
    })
    .onEnd((event) => {
      const commit = event.translationX * openDirection > width / 3 || event.velocityX * openDirection > VELOCITY_THRESHOLD
      if (commit) {
        translateX.value = withSpring(0, SPRING)
        runOnJS(onOpen)()
      } else {
        translateX.value = withSpring(closedX, SPRING)
      }
    })

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.edge, side === 'left' ? styles.left : styles.right]} />
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  edge: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: EDGE_WIDTH,
    zIndex: 5
  },
  left: { left: 0 },
  right: { right: 0 }
})
