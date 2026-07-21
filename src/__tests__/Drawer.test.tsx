import { Pressable } from '@rific/haptic-press'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { Drawer } from '../Drawer'

const MockPressable = Pressable as unknown as jest.Mock

describe('Drawer', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls onClose when the backdrop is pressed', () => {
    const onClose = jest.fn()
    render(<Drawer onClose={onClose} open />)

    MockPressable.mock.calls[0][0].onPress()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders its content', () => {
    render(
      <Drawer onClose={jest.fn()} open>
        <span>drawer content</span>
      </Drawer>
    )

    expect(screen.getByText('drawer content')).toBeTruthy()
  })
})
