import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

export const BlurView = jest.fn(stub)

export const useBlur = jest.fn((override?: boolean) => override ?? false)
