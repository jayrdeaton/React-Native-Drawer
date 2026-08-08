import { getClosedOffset, getExpandProgress, getOpenDirection, isVerticalSide } from '../geometry'

describe('isVerticalSide', () => {
  it('returns true for top and bottom', () => {
    expect(isVerticalSide('top')).toBe(true)
    expect(isVerticalSide('bottom')).toBe(true)
  })

  it('returns false for left and right', () => {
    expect(isVerticalSide('left')).toBe(false)
    expect(isVerticalSide('right')).toBe(false)
  })
})

describe('getClosedOffset', () => {
  it('returns a negative offset for left', () => {
    expect(getClosedOffset('left', 300)).toBe(-300)
  })

  it('returns a positive offset for right', () => {
    expect(getClosedOffset('right', 300)).toBe(300)
  })

  it('returns a negative offset for top', () => {
    expect(getClosedOffset('top', 250)).toBe(-250)
  })

  it('returns a positive offset for bottom', () => {
    expect(getClosedOffset('bottom', 250)).toBe(250)
  })
})

describe('getOpenDirection', () => {
  it('returns 1 for left', () => {
    expect(getOpenDirection('left')).toBe(1)
  })

  it('returns -1 for right', () => {
    expect(getOpenDirection('right')).toBe(-1)
  })

  it('returns 1 for top', () => {
    expect(getOpenDirection('top')).toBe(1)
  })

  it('returns -1 for bottom', () => {
    expect(getOpenDirection('bottom')).toBe(-1)
  })
})

describe('getExpandProgress', () => {
  it('is always 1 when restD is 0: no expand range, rest already is the full extent', () => {
    expect(getExpandProgress(0, 0)).toBe(1)
    expect(getExpandProgress(50, 0)).toBe(1)
  })

  it('is always 1 for a degenerate negative restD too', () => {
    expect(getExpandProgress(0, -10)).toBe(1)
  })

  it('is 0 exactly at rest', () => {
    expect(getExpandProgress(100, 100)).toBe(0)
  })

  it('is 1 exactly at fully expanded', () => {
    expect(getExpandProgress(0, 100)).toBe(1)
  })

  it('interpolates linearly between rest and fully expanded', () => {
    // 25 of the way from expanded (0) to rest (100), i.e. 75% expanded.
    expect(getExpandProgress(25, 100)).toBe(0.75)
    expect(getExpandProgress(75, 100)).toBe(0.25)
  })

  it('clamps to 0 anywhere still in the closed-to-rest segment, past rest', () => {
    expect(getExpandProgress(150, 100)).toBe(0)
  })

  it('clamps to 1 for an overshoot past fully expanded', () => {
    expect(getExpandProgress(-10, 100)).toBe(1)
  })
})
