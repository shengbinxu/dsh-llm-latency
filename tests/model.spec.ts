import { describe, it, expect } from 'vitest'

import { canonicalModel, distinctCanonicals } from '../src/model.js'

describe('model normalization', () => {
  it('maps aliased ids to canonical, else passes through', () => {
    const aliases = { 'deepseek-v4': ['deepseek-v4-pro', 'deepseek-v4-flash'] }
    expect(canonicalModel('deepseek-v4-pro', aliases)).toBe('deepseek-v4')
    expect(canonicalModel('deepseek-v4-flash', aliases)).toBe('deepseek-v4')
    expect(canonicalModel('other-model', aliases)).toBe('other-model')
  })

  it('collects distinct canonicals sorted', () => {
    const aliases = { 'deepseek-v4': ['a', 'b'] }
    expect(distinctCanonicals(['a', 'b', 'c'], aliases)).toEqual(['c', 'deepseek-v4'])
  })
})
