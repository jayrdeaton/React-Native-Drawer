import { createContext, JSX, ReactNode, useContext, useMemo, useState } from 'react'
import { useSharedValue } from 'react-native-reanimated'

import { Drawer } from './Drawer'
import { DrawerEdgeSwipe } from './DrawerEdgeSwipe'

export type DrawerActions = {
  close: () => void
  isOpen: boolean
  open: () => void
}

export type CreateDrawerOptions = {
  side?: 'left' | 'right'
  width?: number
}

export type DrawerProviderProps = {
  // Rest-of-app content the drawer's actions must be reachable from — a normal Provider children slot.
  children?: ReactNode
  // The drawer panel's own content, rendered inside the sliding panel rather than as `children`.
  content?: ReactNode
  // Lets a screen temporarily suppress the edge-swipe gesture (e.g. while another drawer is open).
  enabled?: boolean
}

export type CreateDrawerResult = {
  DrawerProvider: (props: DrawerProviderProps) => JSX.Element
  useDrawer: () => DrawerActions
}

const noop = () => {}

// One call per drawer instance — each gets its own Context, so a left nav drawer and a right
// settings drawer (say) stay fully independent without a stringly-typed id to keep them apart.
export const createDrawer = ({ side = 'left', width = 300 }: CreateDrawerOptions = {}): CreateDrawerResult => {
  const DrawerActionsContext = createContext<DrawerActions>({ close: noop, isOpen: false, open: noop })

  const DrawerProvider = ({ children, content, enabled = true }: DrawerProviderProps): JSX.Element => {
    const [isOpen, setIsOpen] = useState(false)
    const closedX = side === 'left' ? -width : width
    const translateX = useSharedValue(closedX)

    const actions = useMemo<DrawerActions>(
      () => ({
        close: () => setIsOpen(false),
        isOpen,
        open: () => setIsOpen(true)
      }),
      [isOpen]
    )

    return (
      <DrawerActionsContext.Provider value={actions}>
        {children}
        <DrawerEdgeSwipe enabled={enabled && !isOpen} onOpen={() => setIsOpen(true)} side={side} translateX={translateX} width={width} />
        <Drawer onClose={() => setIsOpen(false)} open={isOpen} side={side} translateX={translateX} width={width}>
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
