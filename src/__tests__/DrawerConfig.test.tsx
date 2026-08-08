import { render } from '@testing-library/react'
import React from 'react'

import { type AutoPaperModule, configureDrawer, DrawerProvider, getDrawerConfig } from '../DrawerConfig'

const fakeAutoPaper: AutoPaperModule = {
  BlurView: ({ children }) => <>{children}</>,
  useBlur: () => true
}

describe('configureDrawer / getDrawerConfig', () => {
  it('is readable via the bare function, without any Provider', () => {
    configureDrawer({ autoPaper: fakeAutoPaper })
    expect(getDrawerConfig().autoPaper).toBe(fakeAutoPaper)
  })

  it('merges partial updates instead of replacing the whole config', () => {
    configureDrawer({ autoPaper: fakeAutoPaper })
    configureDrawer({})
    expect(getDrawerConfig().autoPaper).toBe(fakeAutoPaper)
  })
})

describe('DrawerProvider', () => {
  it('calls configureDrawer() synchronously during render, before children render', () => {
    let seenDuringChildRender: AutoPaperModule | undefined
    const Probe = () => {
      seenDuringChildRender = getDrawerConfig().autoPaper
      return null
    }

    render(
      <DrawerProvider autoPaper={fakeAutoPaper}>
        <Probe />
      </DrawerProvider>
    )

    expect(seenDuringChildRender).toBe(fakeAutoPaper)
  })
})
