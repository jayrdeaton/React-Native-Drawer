import { render, screen } from '@testing-library/react'
import React from 'react'

import { Drawer } from '../Drawer'

// @rific/auto-paper is an optional peer, configured via configureDrawer()/<DrawerProvider>,
// never auto-detected. Rendering <Drawer> with no configuration (the "app never wired it up"
// case) must fall back to the solid panel, not throw.
describe('Drawer when @rific/auto-paper is not configured', () => {
  it('renders the plain solid fallback instead of throwing, even when blur is requested', () => {
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
