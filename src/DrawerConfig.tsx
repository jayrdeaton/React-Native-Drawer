import { createModuleConfig } from '@rific/core'
import { type ComponentType, type ReactNode } from 'react'
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native'

// Local mirror of @rific/auto-paper's exports, limited to what Drawer touches. Avoids
// forcing TypeScript to resolve the optional peer's real types for consumers who never
// installed it. @rific/auto-paper is never auto-detected: Metro doesn't rewrite a
// require()-in-try/catch call into its module graph inside an ESM (.mjs) build, so the
// module-level detection this package used to do silently broke as soon as consumers'
// bundlers resolved this package's ESM entry point.
export type AutoPaperModule = {
  BlurView: ComponentType<{ children?: ReactNode; onLayout?: (event: LayoutChangeEvent) => void; style?: StyleProp<ViewStyle> }>
  useBlur: (override?: boolean) => boolean
}

export type DrawerConfig = {
  /** Injects @rific/auto-paper so Drawer's panel renders a real frosted-glass backdrop via BlurView/useBlur instead of its solid-fill fallback. Pass `import * as AutoPaper from '@rific/auto-paper'`; omit to keep the solid fallback. */
  autoPaper?: AutoPaperModule
}

// @rific/core's createModuleConfig() supplies the module-level config singleton (configure/
// getConfig/Provider) every @rific package wires up the same way - see its own doc comment for
// why this is plain module state rather than React Context.
//
// Not to be confused with the per-instance provider createDrawer() returns
// (DrawerInstanceProvider): this one is app-wide, mounted once, for optional peer config;
// that one is per-drawer, mounted once per createDrawer() call, for that drawer's own state.
const drawerConfig = createModuleConfig<DrawerConfig>()

export const configureDrawer = drawerConfig.configure
export const getDrawerConfig = drawerConfig.getConfig
export const DrawerProvider = drawerConfig.Provider

export type DrawerProviderProps = DrawerConfig & { children: ReactNode }
