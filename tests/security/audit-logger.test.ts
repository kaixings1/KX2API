/**
 * AuditLogger — unit tests
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import { AuditLogger } from '../../src/security/AuditLogger.ts'

function tmpFile(): string {
  return path.join(os.tmpdir(), `audit-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`)
}

test('AuditLogger: log + query roundtrip', async () => {
  const file = tmpFile()
  const al = new AuditLogger(file)
  try {
    al.log({
      level: 'info',
      category: 'test',
      action: 'test_action',
      details: { key: 'value' },
      result: 'success',
    })
    await al.flush()
    const entries = await al.query({ category: 'test' })
    assert.strictEqual(entries.length, 1)
    assert.strictEqual(entries[0]!.category, 'test')
    assert.strictEqual(entries[0]!.action, 'test_action')
  } finally {
    al.stop()
    await fs.promises.unlink(file).catch(() => {})
  }
})

test('AuditLogger: logToolCall helper', async () => {
  const file = tmpFile()
  const al = new AuditLogger(file)
  try {
    al.logToolCall({
      tool: 'shell',
      action: 'execute',
      params: { cmd: 'ls' },
      result: 'success',
    })
    await al.flush()
    const entries = await al.query({ tool: 'shell' })
    assert.strictEqual(entries.length, 1)
    assert.strictEqual(entries[0]!.category, 'tool_call')
  } finally {
    al.stop()
    await fs.promises.unlink(file).catch(() => {})
  }
})

test('AuditLogger: logPermissionChange helper', async () => {
  const file = tmpFile()
  const al = new AuditLogger(file)
  try {
    al.logPermissionChange({
      action: 'grant',
      tool: 'file',
      decision: 'allow',
    })
    await al.flush()
    const entries = await al.query({ category: 'permission' })
    assert.strictEqual(entries.length, 1)
    assert.strictEqual(entries[0]!.tool, 'file')
  } finally {
    al.stop()
    await fs.promises.unlink(file).catch(() => {})
  }
})

test('AuditLogger: logSecurityEvent helper', async () => {
  const file = tmpFile()
  const al = new AuditLogger(file)
  try {
    al.logSecurityEvent({
      event: 'injection_attempt',
      severity: 'critical',
      details: { source: 'test' },
    })
    // critical triggers auto-flush, but wait for it
    await new Promise(r => setTimeout(r, 50))
    const entries = await al.query({ level: 'critical' })
    assert.strictEqual(entries.length, 1)
    assert.strictEqual(entries[0]!.result, 'failure')
  } finally {
    al.stop()
    await fs.promises.unlink(file).catch(() => {})
  }
})

test('AuditLogger: query with category filter', async () => {
  const file = tmpFile()
  const al = new AuditLogger(file)
  try {
    al.log({
      level: 'info',
      category: 'alpha',
      action: 'action_a',
      details: {},
      result: 'success',
    })
    al.log({
      level: 'info',
      category: 'beta',
      action: 'action_b',
      details: {},
      result: 'success',
    })
    await al.flush()
    const entries = await al.query({ category: 'alpha' })
    assert.strictEqual(entries.length, 1)
    assert.strictEqual(entries[0]!.action, 'action_a')
  } finally {
    al.stop()
    await fs.promises.unlink(file).catch(() => {})
  }
})

test('AuditLogger: limit truncates results', async () => {
  const file = tmpFile()
  const al = new AuditLogger(file)
  try {
    for (let i = 0; i < 5; i++) {
      al.log({
        level: 'info',
        category: 'test',
        action: `action_${i}`,
        details: {},
        result: 'success',
      })
    }
    await al.flush()
    const entries = await al.query({ limit: 3 })
    assert.strictEqual(entries.length, 3)
  } finally {
    al.stop()
    await fs.promises.unlink(file).catch(() => {})
  }
})

test('AuditLogger: sanitizeParams redacts sensitive keys', async () => {
  const file = tmpFile()
  const al = new AuditLogger(file)
  try {
    al.logToolCall({
      tool: 'shell',
      action: 'run',
      params: { cmd: 'ls', password: 'secret123', apiKey: 'key456' },
      result: 'success',
    })
    await al.flush()
    const entries = await al.query({ tool: 'shell' })
    const details = entries[0]!.details as any
    assert.strictEqual(details.params.password, '***REDACTED***')
    assert.strictEqual(details.params.apiKey, '***REDACTED***')
    assert.strictEqual(details.params.cmd, 'ls')
  } finally {
    al.stop()
    await fs.promises.unlink(file).catch(() => {})
  }
})

test('AuditLogger: stop() clears timer and flushes', async () => {
  const file = tmpFile()
  const al = new AuditLogger(file)
  try {
    al.log({
      level: 'info',
      category: 'test',
      action: 'pre_stop',
      details: {},
      result: 'success',
    })
    al.stop()
    await new Promise(r => setTimeout(r, 50))
    const entries = await al.query()
    assert.ok(entries.length >= 1)
  } finally {
    await fs.promises.unlink(file).catch(() => {})
  }
})
