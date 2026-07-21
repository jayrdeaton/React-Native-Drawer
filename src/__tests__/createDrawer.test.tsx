import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createDrawer } from '../createDrawer'

describe('createDrawer', () => {
  it('starts closed and toggles via open()/close()', () => {
    const { DrawerProvider, useDrawer } = createDrawer()

    const Consumer = () => {
      const { isOpen, open, close } = useDrawer()
      return (
        <>
          <div data-testid='state'>{isOpen ? 'open' : 'closed'}</div>
          <button onClick={open}>open</button>
          <button onClick={close}>close</button>
        </>
      )
    }

    render(
      <DrawerProvider>
        <Consumer />
      </DrawerProvider>
    )

    expect(screen.getByTestId('state').textContent).toBe('closed')
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByTestId('state').textContent).toBe('open')
    fireEvent.click(screen.getByText('close'))
    expect(screen.getByTestId('state').textContent).toBe('closed')
  })

  it('gives independent state to separate createDrawer() instances', () => {
    const left = createDrawer({ side: 'left' })
    const right = createDrawer({ side: 'right' })

    const Consumer = ({ useHook, label }: { useHook: () => ReturnType<typeof left.useDrawer>; label: string }) => {
      const { isOpen, open } = useHook()
      return (
        <>
          <div data-testid={`${label}-state`}>{isOpen ? 'open' : 'closed'}</div>
          <button onClick={open}>{`open-${label}`}</button>
        </>
      )
    }

    render(
      <left.DrawerProvider>
        <right.DrawerProvider>
          <Consumer useHook={left.useDrawer} label='left' />
          <Consumer useHook={right.useDrawer} label='right' />
        </right.DrawerProvider>
      </left.DrawerProvider>
    )

    fireEvent.click(screen.getByText('open-left'))
    expect(screen.getByTestId('left-state').textContent).toBe('open')
    expect(screen.getByTestId('right-state').textContent).toBe('closed')
  })

  it('useDrawer() outside a Provider returns safe no-op defaults', () => {
    const { useDrawer } = createDrawer()

    const Consumer = () => {
      const { isOpen, open, close } = useDrawer()
      expect(isOpen).toBe(false)
      expect(() => open()).not.toThrow()
      expect(() => close()).not.toThrow()
      return null
    }

    render(<Consumer />)
  })
})
