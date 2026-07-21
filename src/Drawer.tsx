import { Pressable } from '@rific/haptic-press'
import { ReactNode, useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { useTheme } from 'react-native-paper'
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

const SPRING = { damping: 40, stiffness: 300, overshootClamping: true }

export type DrawerProps = {
  // Renders edge-to-edge behind the status bar/notch/home indicator, deliberately — pad your own
  // content with useSafeAreaInsets() (or a safe-area-aware header like @rific/scroll-view's) rather
  // than have this component impose a strategy that might double up with one you're already using.
  children?: ReactNode
  onClose: () => void
  open: boolean
  side?: 'left' | 'right'
  translateX?: SharedValue<number>
  width?: number
}

export const Drawer = ({ children, onClose, open, side = 'left', translateX: externalTranslateX, width = 300 }: DrawerProps) => {
  const { colors } = useTheme()
  const closedX = side === 'left' ? -width : width
  const internalTranslateX = useSharedValue(closedX)
  const translateX = externalTranslateX ?? internalTranslateX

  useEffect(() => {
    translateX.value = withSpring(open ? 0 : closedX, SPRING)
  }, [open, closedX, translateX])

  const drawerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: (1 - Math.abs(translateX.value) / width) * 0.45 }))

  const positionStyle = side === 'left' ? styles.anchorLeft : styles.anchorRight

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.drawer, positionStyle, { backgroundColor: colors.surface, width }, drawerStyle]}>{children}</Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  anchorLeft: {
    left: 0
  },
  anchorRight: {
    right: 0
  },
  backdrop: {
    backgroundColor: '#000',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 50
  },
  drawer: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    zIndex: 51
  }
})
