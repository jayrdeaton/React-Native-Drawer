import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { combineDrawerProviders, createDrawer } from '../createDrawer'

describe('combineDrawerProviders', () => {
  it('mounts every combined provider, forwarding each its own content', () => {
    const nav = createDrawer({ side: 'left' })
    const settings = createDrawer({ side: 'right' })

    const AllDrawers = combineDrawerProviders([nav.DrawerProvider, { content: <div data-testid='nav-content'>nav</div> }], [settings.DrawerProvider, { content: <div data-testid='settings-content'>settings</div> }])

    render(
      <AllDrawers>
        <div data-testid='app'>app</div>
      </AllDrawers>
    )

    expect(screen.getByTestId('app')).toBeTruthy()
    expect(screen.getByTestId('nav-content')).toBeTruthy()
    expect(screen.getByTestId('settings-content')).toBeTruthy()
  })

  it('keeps each drawer independently stateful after combining', () => {
    const nav = createDrawer()
    const settings = createDrawer()
    const AllDrawers = combineDrawerProviders([nav.DrawerProvider], [settings.DrawerProvider])

    const Consumer = () => {
      const navState = nav.useDrawer()
      const settingsState = settings.useDrawer()
      return (
        <>
          <div data-testid='nav-state'>{navState.isOpen ? 'open' : 'closed'}</div>
          <div data-testid='settings-state'>{settingsState.isOpen ? 'open' : 'closed'}</div>
          <button onClick={navState.open}>open-nav</button>
        </>
      )
    }

    render(
      <AllDrawers>
        <Consumer />
      </AllDrawers>
    )

    fireEvent.click(screen.getByText('open-nav'))

    expect(screen.getByTestId('nav-state').textContent).toBe('open')
    expect(screen.getByTestId('settings-state').textContent).toBe('closed')
  })

  it('works with no entries at all, rendering only children', () => {
    const AllDrawers = combineDrawerProviders()
    render(
      <AllDrawers>
        <div data-testid='app'>app</div>
      </AllDrawers>
    )

    expect(screen.getByTestId('app')).toBeTruthy()
  })
})
