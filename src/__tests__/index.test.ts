import { combineDrawerProviders, createDrawer, Drawer, DrawerEdgeSwipe, type DrawerSide, type DrawerSize, useDrawerSize } from '../index'

describe('package exports', () => {
  it('exports the public API surface', () => {
    expect(typeof createDrawer).toBe('function')
    expect(typeof combineDrawerProviders).toBe('function')
    expect(typeof Drawer).toBe('function')
    expect(typeof DrawerEdgeSwipe).toBe('function')
    expect(typeof useDrawerSize).toBe('function')
  })

  // Type-only, so there's nothing to assert at runtime beyond "this still compiles": guards
  // against DrawerSide silently dropping off the public surface again (it's referenced by
  // DrawerProps/DrawerEdgeSwipeProps/CreateDrawerOptions but geometry.ts itself isn't exported).
  it('exports the DrawerSide type consumers reference in `side` props', () => {
    const side: DrawerSide = 'bottom'
    expect(side).toBe('bottom')
  })

  // Same idea for useDrawerSize's return type, which apps destructure to seed a translateOffset.
  it('exports the DrawerSize type useDrawerSize returns', () => {
    const size: DrawerSize = { closedOffset: -300, effectiveSize: 300, maxEffectiveSize: 300, restOffset: 0 }
    expect(size.closedOffset).toBe(-300)
  })
})
