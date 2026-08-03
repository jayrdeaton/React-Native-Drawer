import { getClosedOffset, getOpenDirection, isVerticalSide } from '../geometry'

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
