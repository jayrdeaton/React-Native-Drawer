import { render, screen } from '@testing-library/react'
import React from 'react'

// @rific/auto-paper is an optional peer. jest.config.cjs's moduleNameMapper normally redirects it
// to a mock so the rest of the suite can exercise the blur path, but that means the "peer isn't
// installed at all" branch (Drawer.tsx's require() throwing, caught to fall back to a solid panel)
// never runs anywhere else. This file overrides that mapping for itself only, simulating an app
// that never ran `npm install @rific/auto-paper`. Deliberately no jest.resetModules(): that would
// also evict the already-loaded React/ReactDOM modules, leaving `../Drawer`'s fresh require() using
// a different React instance than the one this file's own `import React` and @testing-library/react
// are holding — two copies of React in the same render breaks hooks entirely. Since nothing in this
// file has required '../Drawer' (or, transitively, '@rific/auto-paper') yet, doMock alone is enough
// to intercept its very first load.
describe('Drawer when @rific/auto-paper is not installed', () => {
  jest.doMock(
    '@rific/auto-paper',
    () => {
      throw new Error("Cannot find module '@rific/auto-paper'")
    },
    { virtual: true }
  )

  it('renders the plain solid fallback instead of throwing, even when blur is requested', () => {
    const { Drawer } = require('../Drawer') as typeof import('../Drawer')

    expect(() =>
      render(
        <Drawer blur onClose={jest.fn()} open>
          <span>drawer content</span>
        </Drawer>
      )
    ).not.toThrow()

    expect(screen.getByText('drawer content')).toBeTruthy()
  })
})
