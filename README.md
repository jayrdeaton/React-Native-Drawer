# @rific/drawer

Left/right sliding drawer for React Native. Spring-animated, theme-aware (reads colors from `react-native-paper`), and opens either by calling an action or by swiping in from the screen edge. One `createDrawer()` call per drawer instance, so a left nav drawer and a right settings drawer stay fully independent.

## Install

```sh
npm install @rific/drawer
```

**Peer dependencies:**

```sh
npm install react-native-gesture-handler react-native-reanimated react-native-paper @rific/haptic-press
```

Your app's root must already be wrapped in `GestureHandlerRootView` (from `react-native-gesture-handler`). This package doesn't add its own, since only one should ever wrap the whole app.

## Usage

```tsx
import { createDrawer } from '@rific/drawer'

const { DrawerProvider: NavDrawerProvider, useDrawer: useNavDrawer } = createDrawer({ side: 'left', width: 300 })
const { DrawerProvider: SettingsDrawerProvider, useDrawer: useSettingsDrawer } = createDrawer({ side: 'right', width: 320 })
```

Mount each `DrawerProvider` once, near your app root: `children` is the rest of the app (so `useDrawer()` is reachable from anywhere inside it), and `content` is what renders inside the sliding panel itself. With more than one drawer, `combineDrawerProviders` flattens the nesting into a single wrapper (first argument is outermost, matching how you'd nest them by hand):

```tsx
import { combineDrawerProviders } from '@rific/drawer'

const AllDrawersProvider = combineDrawerProviders([NavDrawerProvider, { content: <AppDrawerContent /> }], [SettingsDrawerProvider, { content: <SettingsDrawerContent /> }])

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AllDrawersProvider>
        <RootNavigator />
      </AllDrawersProvider>
    </GestureHandlerRootView>
  )
}
```

Each drawer's state stays fully independent under the hood. This is purely a way to avoid writing out the nesting by hand. With a single drawer, just render its `DrawerProvider` directly with a `content` prop; `combineDrawerProviders` only earns its keep once you have more than one.

Then anywhere else in the tree:

```tsx
import { useNavDrawer } from '@/drawers'

const { isOpen, open, close } = useNavDrawer()

<IconButton icon='menu' onPress={open} />
```

The drawer opens by calling `open()`, by tapping the backdrop or an in-content close button (call `close()`), or by swiping in from the screen edge. No extra wiring is needed for the swipe gesture; it's built into `DrawerProvider`. Pass `enabled={false}` to `DrawerProvider` to temporarily suppress the edge-swipe gesture (e.g. on a screen where it would conflict with another gesture).

## Safe area

The panel renders edge-to-edge, behind the status bar/notch and home indicator, on purpose. This package doesn't take a position on how you handle that. Pad your `content` yourself, however fits your app: `useSafeAreaInsets()` from `react-native-safe-area-context` directly, or a safe-area-aware header like `@rific/scroll-view`'s. Baking a fixed strategy into the panel itself would double up with whichever one you're already using for the rest of your app.

## Lower-level pieces

`Drawer` (the sliding panel and backdrop) and `DrawerEdgeSwipe` (the edge gesture zone) are also exported directly, for apps that want to manage the open/closed state and shared value themselves instead of using `createDrawer()`.
