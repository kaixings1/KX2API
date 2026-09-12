/**
 * CircularBuffer.ts — unit tests
 *
 * Pure data structure, zero dependencies.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { CircularBuffer } from '../../src/main/utils/CircularBuffer.ts'

// ===========================================================================
// Basic add / getRecent
// ===========================================================================

test('add + getRecent: single item', () => {
  const buf = new CircularBuffer<number>(5)
  buf.add(1)
  assert.deepEqual(buf.getRecent(5), [1])
})

test('add + getRecent: multiple items in order', () => {
  const buf = new CircularBuffer<number>(5)
  buf.add(1)
  buf.add(2)
  buf.add(3)
  assert.deepEqual(buf.getRecent(5), [1, 2, 3])
})

test('add + getRecent: getRecent returns most recent N', () => {
  const buf = new CircularBuffer<number>(5)
  buf.add(1)
  buf.add(2)
  buf.add(3)
  buf.add(4)
  buf.add(5)
  assert.deepEqual(buf.getRecent(3), [3, 4, 5])
})

test('add: evicts oldest when full', () => {
  const buf = new CircularBuffer<number>(3)
  buf.add(1)
  buf.add(2)
  buf.add(3)
  buf.add(4) // evicts 1
  assert.deepEqual(buf.toArray(), [2, 3, 4])
})

test('add: capacity of 1', () => {
  const buf = new CircularBuffer<number>(1)
  buf.add(1)
  buf.add(2)
  buf.add(3)
  assert.deepEqual(buf.toArray(), [3])
  assert.strictEqual(buf.length(), 1)
})

// ===========================================================================
// toArray
// ===========================================================================

test('toArray: empty buffer', () => {
  const buf = new CircularBuffer<number>(3)
  assert.deepEqual(buf.toArray(), [])
})

test('toArray: partial fill', () => {
  const buf = new CircularBuffer<number>(5)
  buf.add(10)
  buf.add(20)
  assert.deepEqual(buf.toArray(), [10, 20])
})

test('toArray: full buffer oldest to newest', () => {
  const buf = new CircularBuffer<number>(3)
  buf.add('a')
  buf.add('b')
  buf.add('c')
  assert.deepEqual(buf.toArray(), ['a', 'b', 'c'])
})

test('toArray: after wrap-around', () => {
  const buf = new CircularBuffer<number>(3)
  buf.add(1)
  buf.add(2)
  buf.add(3)
  buf.add(4)
  buf.add(5)
  assert.deepEqual(buf.toArray(), [3, 4, 5])
})

// ===========================================================================
// addAll
// ===========================================================================

test('addAll: adds all items', () => {
  const buf = new CircularBuffer<number>(10)
  buf.addAll([1, 2, 3, 4, 5])
  assert.strictEqual(buf.length(), 5)
  assert.deepEqual(buf.toArray(), [1, 2, 3, 4, 5])
})

test('addAll: evicts oldest when overflow', () => {
  const buf = new CircularBuffer<number>(3)
  buf.addAll([1, 2, 3, 4, 5])
  assert.strictEqual(buf.length(), 3)
  assert.deepEqual(buf.toArray(), [3, 4, 5])
})

test('addAll: empty array safe', () => {
  const buf = new CircularBuffer<number>(3)
  buf.addAll([])
  assert.strictEqual(buf.length(), 0)
  assert.deepEqual(buf.toArray(), [])
})

// ===========================================================================
// clear
// ===========================================================================

test('clear: empties buffer', () => {
  const buf = new CircularBuffer<number>(3)
  buf.add(1)
  buf.add(2)
  buf.clear()
  assert.strictEqual(buf.length(), 0)
  assert.deepEqual(buf.toArray(), [])
})

test('clear: reusable after clear', () => {
  const buf = new CircularBuffer<number>(3)
  buf.add(1)
  buf.add(2)
  buf.clear()
  buf.add(99)
  assert.deepEqual(buf.toArray(), [99])
})

// ===========================================================================
// length
// ===========================================================================

test('length: tracks size correctly', () => {
  const buf = new CircularBuffer<number>(5)
  assert.strictEqual(buf.length(), 0)
  buf.add(1)
  assert.strictEqual(buf.length(), 1)
  buf.add(2)
  assert.strictEqual(buf.length(), 2)
})

test('length: caps at capacity', () => {
  const buf = new CircularBuffer<number>(3)
  buf.add(1)
  buf.add(2)
  buf.add(3)
  buf.add(4)
  buf.add(5)
  assert.strictEqual(buf.length(), 3)
})

// ===========================================================================
// Generic types
// ===========================================================================

test('generic: works with strings', () => {
  const buf = new CircularBuffer<string>(3)
  buf.add('hello')
  buf.add('world')
  assert.deepEqual(buf.toArray(), ['hello', 'world'])
})

test('generic: works with objects', () => {
  interface Item { id: number; name: string }
  const buf = new CircularBuffer<Item>(2)
  buf.add({ id: 1, name: 'a' })
  buf.add({ id: 2, name: 'b' })
  buf.add({ id: 3, name: 'c' })
  assert.deepEqual(buf.toArray(), [
    { id: 2, name: 'b' },
    { id: 3, name: 'c' },
  ])
})
