import { renderHook } from '@testing-library/react'
import { useWindowDimensions } from 'react-native'

import { useDrawerSize } from '../useDrawerSize'

const MockUseWindowDimensions = useWindowDimensions as unknown as jest.Mock
const setWindow = (width: number, height: number) => MockUseWindowDimensions.mockReturnValue({ fontScale: 1, height, scale: 1, width })

describe('useDrawerSize', () => {
  // Back to the react-native mock's own default window (400x800) for every other spec file.
  afterEach(() => setWindow(400, 800))

  it('resolves a px size that fits the window untouched', () => {
    setWindow(400, 800)
    const { result } = renderHook(() => useDrawerSize('left', 380))

    expect(result.current).toEqual({ closedOffset: -380, effectiveSize: 380, maxEffectiveSize: 380, restOffset: 0 })
  })

  it('caps a px width wider than the window at the window width, with every offset following from the capped size', () => {
    setWindow(360, 780)
    const { result } = renderHook(() => useDrawerSize('left', 380))

    expect(result.current).toEqual({ closedOffset: -360, effectiveSize: 360, maxEffectiveSize: 360, restOffset: 0 })
  })

  it('caps against the axis the side uses: width for left/right, height for top/bottom', () => {
    setWindow(360, 500)

    expect(renderHook(() => useDrawerSize('right', 380)).result.current.closedOffset).toBe(360)
    expect(renderHook(() => useDrawerSize('bottom', 600)).result.current.closedOffset).toBe(500)
    // 380 fits a 500-tall window, so a top sheet's height is untouched even though it's wider than 360.
    expect(renderHook(() => useDrawerSize('top', 380)).result.current.closedOffset).toBe(-380)
  })

  it('caps maxSize too, keeping the rest offset consistent with the capped ceiling', () => {
    setWindow(400, 800)
    const { result } = renderHook(() => useDrawerSize('left', 300, 500))

    expect(result.current).toEqual({ closedOffset: -400, effectiveSize: 300, maxEffectiveSize: 400, restOffset: -100 })
  })

  it('caps a percentage over 100% at the window size as well', () => {
    setWindow(400, 800)

    expect(renderHook(() => useDrawerSize('bottom', '120%')).result.current.effectiveSize).toBe(800)
  })

  it('caps a px size against the raw window, not the edgeInset-shrunk basis: edgeInset still never touches a px value', () => {
    setWindow(400, 800)
    const { result } = renderHook(() => useDrawerSize('bottom', 300, 900, 50))

    expect(result.current.maxEffectiveSize).toBe(800)
  })

  it('leaves sizes untouched while the window is still unmeasured (0x0 on web before hydration)', () => {
    setWindow(0, 0)
    const { result } = renderHook(() => useDrawerSize('left', 380))

    expect(result.current).toEqual({ closedOffset: -380, effectiveSize: 380, maxEffectiveSize: 380, restOffset: 0 })
  })

  it('follows the window when it changes size', () => {
    setWindow(430, 800)
    const { rerender, result } = renderHook(() => useDrawerSize('left', 380))
    expect(result.current.effectiveSize).toBe(380)

    setWindow(360, 800)
    rerender()

    expect(result.current).toEqual({ closedOffset: -360, effectiveSize: 360, maxEffectiveSize: 360, restOffset: 0 })
  })
})
