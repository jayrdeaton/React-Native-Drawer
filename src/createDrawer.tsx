import { createContext, JSX, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { BackHandler } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

import { Drawer } from './Drawer'
import { DrawerEdgeSwipe } from './DrawerEdgeSwipe'
import { type DrawerSide, getClosedOffset, isVerticalSide } from './geometry'

export type DrawerActions = {
  close: () => void
  isOpen: boolean
  // True from open() through the full close animation, only dropping to false once the panel has
  // actually finished sliding away — unlike isOpen, which flips the instant close() is called. For
  // anything that needs to stay above/alongside the panel for as long as it's visually on screen
  // (e.g. a FAB row portaled above it) rather than disappearing the moment closing starts.
  isVisible: boolean
  open: () => void
}

export type CreateDrawerOptions = {
  backdropOpacity?: number
  blockingBackdrop?: boolean
  blur?: boolean
  // Whether the Android hardware back button closes the drawer while it's open, instead of falling
  // through to whatever screen/navigator is behind it. No-ops on iOS/web, where the underlying
  // BackHandler event never fires.
  closeOnBackPress?: boolean
  contentSize?: boolean
  dismissible?: boolean
  height?: number
  showHandle?: boolean
  side?: DrawerSide
  width?: number
  // Stacking tier for this drawer's backdrop/panel/handle — see Drawer's own zIndex doc for the full
  // rationale. Matters once more than one createDrawer() instance can be open at the same time: give
  // whichever one should render on top a higher value than the other(s), independent of which
  // DrawerProvider happens to be declared outermost/innermost.
  zIndex?: number
}

export type DrawerProviderProps = {
  // Overrides the backdropOpacity passed to createDrawer() (if any) for this mount.
  backdropOpacity?: number
  // Overrides the blockingBackdrop passed to createDrawer() (if any) for this mount.
  blockingBackdrop?: boolean
  // Overrides the blur passed to createDrawer() (if any) for this mount; falls through to
  // @rific/auto-paper's own useBlur() global preference when neither is set.
  blur?: boolean
  // Rest-of-app content the drawer's actions must be reachable from — a normal Provider children slot.
  children?: ReactNode
  // Overrides the closeOnBackPress passed to createDrawer() (if any) for this mount.
  closeOnBackPress?: boolean
  // The drawer panel's own content, rendered inside the sliding panel rather than as `children`.
  content?: ReactNode
  // Overrides the contentSize passed to createDrawer() (if any) for this mount.
  contentSize?: boolean
  // Overrides the dismissible passed to createDrawer() (if any) for this mount.
  dismissible?: boolean
  // Lets a screen temporarily suppress the edge-swipe gesture (e.g. while another drawer is open).
  enabled?: boolean
  // Overrides the showHandle passed to createDrawer() (if any) for this mount.
  showHandle?: boolean
  // Overrides the zIndex passed to createDrawer() (if any) for this mount.
  zIndex?: number
}

export type CreateDrawerResult = {
  DrawerProvider: (props: DrawerProviderProps) => JSX.Element
  useDrawer: () => DrawerActions
}

const noop = () => {}

// One call per drawer instance — each gets its own Context, so a left nav drawer and a right
// settings drawer (say) stay fully independent without a stringly-typed id to keep them apart.
export const createDrawer = ({ backdropOpacity: factoryBackdropOpacity, blockingBackdrop: factoryBlockingBackdrop, blur: factoryBlur, closeOnBackPress: factoryCloseOnBackPress, contentSize: factoryContentSize, dismissible: factoryDismissible, height = 300, showHandle: factoryShowHandle, side = 'left', width = 300, zIndex: factoryZIndex }: CreateDrawerOptions = {}): CreateDrawerResult => {
  const DrawerActionsContext = createContext<DrawerActions>({ close: noop, isOpen: false, isVisible: false, open: noop })
  const vertical = isVerticalSide(side)
  const size = vertical ? height : width
  const closedOffset = getClosedOffset(side, size)

  const DrawerProvider = ({ backdropOpacity: backdropOpacityOverride, blockingBackdrop: blockingBackdropOverride, blur: blurOverride, children, closeOnBackPress: closeOnBackPressOverride, content, contentSize: contentSizeOverride, dismissible: dismissibleOverride, enabled = true, showHandle: showHandleOverride, zIndex: zIndexOverride }: DrawerProviderProps): JSX.Element => {
    const [isOpen, setIsOpen] = useState(false)
    // Starts in lockstep with isOpen (both false) and stays true past isOpen turning false, until
    // Drawer's onClosed reports the outro spring has actually settled — see the isVisible field above.
    const [isVisible, setIsVisible] = useState(false)
    const [measuredSize, setMeasuredSize] = useState<number | null>(null)
    const translateOffset = useSharedValue(closedOffset)
    const backdropOpacity = backdropOpacityOverride ?? factoryBackdropOpacity ?? 0.45
    const blur = blurOverride ?? factoryBlur
    const blockingBackdrop = blockingBackdropOverride ?? factoryBlockingBackdrop ?? true
    const closeOnBackPress = closeOnBackPressOverride ?? factoryCloseOnBackPress ?? true
    const contentSize = contentSizeOverride ?? factoryContentSize ?? false
    const dismissible = dismissibleOverride ?? factoryDismissible ?? true
    const showHandle = showHandleOverride ?? factoryShowHandle ?? true
    const zIndex = zIndexOverride ?? factoryZIndex ?? 50

    // Fed by Drawer's onMeasure, and forwarded (in place of the static option) to both Drawer and
    // DrawerEdgeSwipe — DrawerEdgeSwipe's own commit-threshold math needs the live size too, but it
    // stays agnostic of contentSize itself; it just receives whichever height/width value is current.
    const effectiveSize = contentSize ? (measuredSize ?? size) : size

    const open = () => {
      setIsOpen(true)
      setIsVisible(true)
    }

    const actions = useMemo<DrawerActions>(
      () => ({
        close: () => setIsOpen(false),
        isOpen,
        isVisible,
        open
      }),
      [isOpen, isVisible]
    )

    // Only subscribed while open, so the back button falls through to normal navigation the rest of
    // the time. Returning true from the handler marks the press as consumed (RN's contract for
    // hardwareBackPress), stopping it from also closing a screen/navigator behind the drawer.
    useEffect(() => {
      if (!isOpen || !closeOnBackPress) return

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        setIsOpen(false)
        return true
      })
      return () => subscription.remove()
    }, [isOpen, closeOnBackPress])

    return (
      <DrawerActionsContext.Provider value={actions}>
        {children}
        <DrawerEdgeSwipe enabled={enabled && !isOpen} height={vertical ? effectiveSize : height} onOpen={open} side={side} translateOffset={translateOffset} width={vertical ? width : effectiveSize} />
        <Drawer backdropOpacity={backdropOpacity} blockingBackdrop={blockingBackdrop} blur={blur} contentSize={contentSize} dismissible={dismissible} height={vertical ? effectiveSize : height} onClose={() => setIsOpen(false)} onClosed={() => setIsVisible(false)} onMeasure={setMeasuredSize} open={isOpen} showHandle={showHandle} side={side} translateOffset={translateOffset} width={vertical ? width : effectiveSize} zIndex={zIndex}>
          {content}
        </Drawer>
      </DrawerActionsContext.Provider>
    )
  }

  const useDrawer = (): DrawerActions => useContext(DrawerActionsContext)

  return { DrawerProvider, useDrawer }
}

export type DrawerProviderComponent = (props: DrawerProviderProps) => JSX.Element

// Flattens nesting N createDrawer() providers under the root into a single wrapper. Each entry is
// a [DrawerProvider, props] pair — props are that drawer's own content/enabled, forwarded as-is.
// Argument order is outer-to-inner, matching how you'd otherwise nest them by hand.
export const combineDrawerProviders = (...entries: [DrawerProviderComponent, Omit<DrawerProviderProps, 'children'>?][]) => {
  const CombinedDrawerProviders = ({ children }: { children?: ReactNode }): JSX.Element => entries.reduceRight<ReactNode>((acc, [Provider, props]) => <Provider {...props}>{acc}</Provider>, children) as JSX.Element

  return CombinedDrawerProviders
}
