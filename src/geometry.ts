export type DrawerSide = 'left' | 'right' | 'top' | 'bottom'

export function isVerticalSide(side: DrawerSide): boolean {
  return side === 'top' || side === 'bottom'
}

// left/top start at a negative offset (slide toward 0, i.e. positive, to open);
// right/bottom start at a positive offset (slide toward 0, i.e. negative, to open).
export function getClosedOffset(side: DrawerSide, size: number): number {
  return side === 'left' || side === 'top' ? -size : size
}

// Which drag direction (along the relevant axis) counts as "opening".
export function getOpenDirection(side: DrawerSide): 1 | -1 {
  return side === 'left' || side === 'top' ? 1 : -1
}
