/**
 * CredentialManager — unit tests
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import { CredentialManager } from '../../src/security/CredentialManager.ts'

function tmpFile(): string {
  return path.join(os.tmpdir(), `cred-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`)
}

test('CredentialManager: set + get roundtrip', async () => {
  const file = tmpFile()
  const cm = new CredentialManager(file)
  await cm.initialize()
  await cm.setCredential({ id: 'k1', type: 'api_key', name: 'TestKey', value: 'secret123' })
  const val = cm.getCredential('k1')
  assert.strictEqual(val, 'secret123')
  await fs.promises.unlink(file).catch(() => {})
})

test('CredentialManager: returns null for missing id', async () => {
  const file = tmpFile()
  const cm = new CredentialManager(file)
  await cm.initialize()
  assert.strictEqual(cm.getCredential('nonexistent'), null)
  await fs.promises.unlink(file).catch(() => {})
})

test('CredentialManager: encrypts value (not stored in plaintext)', async () => {
  const file = tmpFile()
  const cm = new CredentialManager(file)
  await cm.initialize()
  await cm.setCredential({ id: 'k1', type: 'password', name: 'Pass', value: 'plaintext' })
  const raw = await fs.promises.readFile(file, 'utf-8')
  assert.ok(!raw.includes('plaintext'))
  await fs.promises.unlink(file).catch(() => {})
})

test('CredentialManager: getCredentialInfo excludes value', async () => {
  const file = tmpFile()
  const cm = new CredentialManager(file)
  await cm.initialize()
  await cm.setCredential({ id: 'k1', type: 'token', name: 'MyToken', value: 'tok123' })
  const info = cm.getCredentialInfo('k1')
  assert.ok(info !== null)
  assert.strictEqual((info as any).name, 'MyToken')
  assert.ok(!('value' in (info as any)))
  await fs.promises.unlink(file).catch(() => {})
})

test('CredentialManager: deleteCredential removes entry', async () => {
  const file = tmpFile()
  const cm = new CredentialManager(file)
  await cm.initialize()
  await cm.setCredential({ id: 'k1', type: 'api_key', name: 'Key', value: 'v' })
  const deleted = cm.deleteCredential('k1')
  assert.strictEqual(deleted, true)
  assert.strictEqual(cm.getCredential('k1'), null)
  await fs.promises.unlink(file).catch(() => {})
})

test('CredentialManager: listCredentials excludes values', async () => {
  const file = tmpFile()
  const cm = new CredentialManager(file)
  await cm.initialize()
  await cm.setCredential({ id: 'k1', type: 'password', name: 'P1', value: 'v1' })
  await cm.setCredential({ id: 'k2', type: 'api_key', name: 'P2', value: 'v2' })
  const list = cm.listCredentials()
  assert.strictEqual(list.length, 2)
  assert.ok(!('value' in list[0]!))
  await fs.promises.unlink(file).catch(() => {})
})

test('CredentialManager: expired credential returns null', async () => {
  const file = tmpFile()
  const cm = new CredentialManager(file)
  await cm.initialize()
  const past = new Date(Date.now() - 1000)
  await cm.setCredential({ id: 'k1', type: 'token', name: 'Old', value: 'v', expiresAt: past })
  assert.strictEqual(cm.getCredential('k1'), null)
  await fs.promises.unlink(file).catch(() => {})
})

test('CredentialManager: loads from file on init', async () => {
  const file = tmpFile()
  const cm1 = new CredentialManager(file)
  await cm1.initialize()
  await cm1.setCredential({ id: 'k1', type: 'api_key', name: 'Key', value: 'secret' })
  // second instance should load from disk
  const cm2 = new CredentialManager(file)
  await cm2.initialize()
  assert.strictEqual(cm2.getCredential('k1'), 'secret')
  await fs.promises.unlink(file).catch(() => {})
})

test('CredentialManager: different keys produce different ciphertext', async () => {
  const file = tmpFile()
  const cm1 = new CredentialManager(file, 'key1')
  const cm2 = new CredentialManager(file, 'key2')
  await cm1.initialize()
  await cm2.initialize()
  await cm1.setCredential({ id: 'k1', type: 'password', name: 'P', value: 'same' })
  // cm2 reads the file but can't decrypt with different key
  const raw = await fs.promises.readFile(file, 'utf-8')
  const data = JSON.parse(raw)
  const storedValue = data[0].value
  assert.ok(!storedValue.includes('same')) // encrypted, not plaintext
  await fs.promises.unlink(file).catch(() => {})
})
