# @rific/drawer

Sliding drawer/sheet for React Native. Spring-animated, theme-aware (reads colors from `react-native-paper`), and opens either by calling an action or by swiping in from the screen edge. Slides in from any of the four edges — `left`/`right` for a nav/settings drawer, `top`/`bottom` for a sheet — same mechanism either way. One `createDrawer()` call per drawer instance, so a left nav drawer and a bottom sheet stay fully independent.

## Install

```sh
npm install @rific/drawer
```

**Peer dependencies:**

```sh
npm install react-native-gesture-handler react-native-reanimated react-native-paper @rific/haptic-press
```

Your app's root must already be wrapped in `GestureHandlerRootView` (from `react-native-gesture-handler`). This package doesn't add its own, since only one should ever wrap the whole app.

Optionally install `@rific/auto-paper` as well to opt into blurred panels — see [Blur](#blur) below.

## Usage

```tsx
import { createDrawer } from '@rific/drawer'

const { DrawerProvider: NavDrawerProvider, useDrawer: useNavDrawer } = createDrawer({ side: 'left', width: 300 })
const { DrawerProvider: SettingsDrawerProvider, useDrawer: useSettingsDrawer } = createDrawer({ side: 'right', width: 320 })
const { DrawerProvider: SheetProvider, useDrawer: useSheet } = createDrawer({ side: 'bottom', height: 400 })
```

`side` accepts `'left'`, `'right'`, `'top'`, or `'bottom'` (default `'left'`). `left`/`right` drawers size themselves with `width` (default `300`); `top`/`bottom` sheets use `height` instead (same default). Only the prop matching the chosen axis matters — pass `width` for a horizontal drawer, `height` for a vertical one.

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

const { isOpen, isVisible, open, close } = useNavDrawer()

<IconButton icon='menu' onPress={open} />
```

`isOpen` flips the instant `open()`/`close()` is called (or a swipe gesture commits). `isVisible` stays `true` for the full close animation too, only dropping to `false` once the panel has actually finished sliding away — useful for anything that needs to stay mounted/visible for as long as the panel is on screen (e.g. a FAB row portaled above it), rather than disappearing the moment closing starts.

The drawer opens by calling `open()`, by tapping the backdrop or an in-content close button (call `close()`), by swiping in from the screen edge, or — by default — by swiping the panel's own drag handle back toward its closed edge. No extra wiring is needed for either gesture; both are built into `DrawerProvider`. Pass `enabled={false}` to `DrawerProvider` to temporarily suppress the edge-swipe gesture (e.g. on a screen where it would conflict with another gesture).

A few more options, settable at `createDrawer()` (a fixed default) and overridable per-mount on `DrawerProvider`, same pattern as `blur` below:

- **`dismissible`** (default `true`) — renders a small drag handle pinned to the panel's edge closest to closed, that can be swiped to dismiss the panel. It's a dedicated hit area, not the whole panel, so it won't conflict with interactive content (sliders, buttons) inside `content`. Pass `dismissible={false}` to remove it — `close()`, an in-content close button, or the backdrop remain as the other dismiss paths.
- **`showHandle`** (default `true`) — whether the drag handle's pill graphic renders. Only affects that visual; the strip's hit area and its drag-to-dismiss gesture (controlled by `dismissible` above) render exactly the same when this is `false` — the strip is still there and still grabbable, just without the pill drawn inside it.
- **`blockingBackdrop`** (default `true`) — whether the backdrop intercepts touches while the panel is open. The dimming/blur visual is unaffected either way; setting it to `false` only stops the backdrop from swallowing touches, so sibling content behind/around the panel stays reachable while it's open (tap-to-dismiss via the backdrop stops working in that mode — `dismissible`'s handle or your own close button take over).
- **`backdropOpacity`** (default `0.45`) — peak backdrop opacity once the panel is fully open, scaled down as it slides toward closed. `0` renders no dimming at all, leaving whatever's behind the panel fully visible. Independent of `blockingBackdrop` — a panel can stay undimmed and still block touches, or vice versa.
- **`contentSize`** (default `false`) — see [Content-driven sizing](#content-driven-sizing) below.
- **`closeOnBackPress`** (default `true`) — whether the Android hardware back button closes the drawer while it's open, instead of falling through to whatever's behind it (a screen, a navigator). No-op on iOS/web, where that back-press event never fires.
- **`zIndex`** (default `50`) — see [Stacking multiple drawers](#stacking-multiple-drawers) below.

## Stacking multiple drawers

If your app can have more than one drawer open at the same time (say, a nav drawer and a confirmation sheet both created via separate `createDrawer()` calls), which one renders on top is otherwise decided by plain View z-index ties, which break on render order — whatever order your `DrawerProvider`s happen to be nested/declared in, not necessarily the order that makes sense for that screen. Give the one that should stack on top a higher `zIndex`:

```tsx
const { DrawerProvider: NavDrawerProvider } = createDrawer({ side: 'left', width: 300 }) // zIndex 50 (default)
const { DrawerProvider: ConfirmSheetProvider } = createDrawer({ side: 'bottom', height: 200, zIndex: 100 })
```

`zIndex` sets the backdrop's stacking tier directly; the panel and its drag handle use `zIndex + 1` / `zIndex + 2`, so raising one drawer's `zIndex` moves its whole backdrop+panel+handle stack together, above any other drawer using a lower value.

## Content-driven sizing

By default the panel is a fixed `height`/`width`. Pass `contentSize` to size it to its content's natural size along the main axis instead, and it'll smoothly animate as that natural size changes (e.g. swapping to differently-sized content while open). `height`/`width` still matter as the pre-measurement placeholder — the size used for the very first render, before the content's natural size has been measured.

This isn't sheet-specific — the main axis is whichever one `side` uses, so it works the same way for a `left`/`right` drawer sizing itself to its content's natural *width* as it does for a `top`/`bottom` sheet sizing to height.

## Safe area

The panel renders edge-to-edge, behind the status bar/notch and home indicator, on purpose. This package doesn't take a position on how you handle that. Pad your `content` yourself, however fits your app: `useSafeAreaInsets()` from `react-native-safe-area-context` directly, or a safe-area-aware header like `@rific/scroll-view`'s. Baking a fixed strategy into the panel itself would double up with whichever one you're already using for the rest of your app.

## Blur

The panel can render with a blurred background instead of a solid one, via the sibling package [`@rific/auto-paper`](https://www.npmjs.com/package/@rific/auto-paper) (which ships a themed `BlurView` and a `useBlur()` hook backed by a global user preference). It's an optional peer — install it to opt in:

```sh
npm install @rific/auto-paper
```

Pass `blur` wherever suits your app: to `createDrawer()` (a fixed default for that drawer), to `DrawerProvider` (overriding the `createDrawer()` default for that mount), or directly to `Drawer` if you're using it standalone. If you don't pass `blur` at all, the panel falls back to `@rific/auto-paper`'s own global `settings.blur` user preference via `useBlur()`.

```tsx
const { DrawerProvider: SettingsDrawerProvider } = createDrawer({ side: 'right', width: 320, blur: true })
```

Only the panel surface blurs — the backdrop behind it stays solid, same as today. Without `@rific/auto-paper` installed, the panel always renders its solid `colors.surface` fallback, exactly as before.

## Lower-level pieces

`Drawer` (the sliding panel and backdrop) and `DrawerEdgeSwipe` (the edge gesture zone) are also exported directly, for apps that want to manage the open/closed state and shared value themselves instead of using `createDrawer()`. Both take a `translateOffset` prop — a `SharedValue<number>` holding the panel's offset along its axis (`translateX` for `left`/`right`, `translateY` for `top`/`bottom`) — so `DrawerEdgeSwipe`'s gesture and `Drawer`'s spring animation can share the same value.

If you're driving `Drawer` standalone with `contentSize` and want `DrawerEdgeSwipe`'s own commit-threshold math to track the measured size too, pass `Drawer` an `onMeasure?: (size: number) => void` and feed the result into the `height`/`width` you pass `DrawerEdgeSwipe` — this is exactly what `createDrawer()` does internally.

`Drawer` also takes an `onClosed?: () => void`, fired once the close spring actually settles rather than the instant `open` flips to `false` — this is what powers `isVisible` above; drive it yourself the same way if you're managing `open` state by hand. `onOpened?: () => void` is the same idea for the open direction — fired once the panel has actually finished sliding in, e.g. to autofocus a field inside `content` only once it's actually on screen. `createDrawer()` doesn't need it internally (nothing downstream waits on the open side settling the way `isVisible` waits on the close side), so it's only available driving `Drawer` directly.

`Drawer` also takes the same `zIndex` prop described in [Stacking multiple drawers](#stacking-multiple-drawers) — useful if you're rendering more than one standalone `Drawer` (or mixing standalone `Drawer`s with `createDrawer()` ones) that might be open at the same time.
