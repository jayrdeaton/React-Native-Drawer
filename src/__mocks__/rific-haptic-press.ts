import React from 'react'

const stub = ({ children }: { children?: React.ReactNode }) => children ?? null

export const Pressable = jest.fn(stub)
