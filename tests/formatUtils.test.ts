/**
 * tests/formatUtils.test.ts — 人类可读格式化工具测试
 *
 * 运行：node --import tsx --test tests/formatUtils.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  humanBytes,
  humanBytesIEC,
  humanNumber,
  humanDuration,
  humanTime,
  humanTimeLower,
} from '../src/utils/formatUtils.ts'

describe('humanBytes 十进制字节格式化', () => {
  const KB = 1000, MB = 1000 * KB, GB = 1000 * MB, TB = 1000 * GB
  test('小于 KB 原样字节', () => {
    assert.equal(humanBytes(500), '500 B')
  })

  test('KB/MB/GB', () => {
    assert.equal(humanBytes(1536), '1.5 KB')
    assert.equal(humanBytes(2 * MB), '2 MB')
    assert.equal(humanBytes(3 * GB), '3 GB')
    assert.equal(humanBytes(4 * TB), '4 TB')
  })
})

describe('humanBytesIEC 二进制格式化', () => {
  const KIB = 1024, MIB = 1024 * KIB, GIB = 1024 * MIB
  test('KiB/MiB/GiB', () => {
    assert.equal(humanBytesIEC(1536), '1.5 KiB')
    assert.equal(humanBytesIEC(2 * MIB), '2.0 MiB')
    assert.equal(humanBytesIEC(3 * GIB), '3.0 GiB')
  })
})

describe('humanNumber 数字短格式', () => {
  test('<1000 原样', () => {
    assert.equal(humanNumber(999), '999')
  })
  test('K/M/B', () => {
    assert.equal(humanNumber(1500), '1K')
    assert.equal(humanNumber(2300000), '2.30M')
    assert.equal(humanNumber(3400000000), '3.4B')
  })
})

describe('humanDuration 时长格式化', () => {
  test('简单时长', () => {
    assert.equal(humanDuration(5), '5 seconds')
    assert.equal(humanDuration(65), 'About a minute')
    assert.equal(humanDuration(3600), 'About an hour')
  })
})

describe('humanTime 相对时间', () => {
  test('过去时间', () => {
    const past = new Date(Date.now() - 65 * 1000)
    assert.ok(humanTime(past).includes('ago'))
  })
  test('未来时间', () => {
    const future = new Date(Date.now() + 2 * 3600 * 1000)
    assert.ok(humanTime(future).includes('from now'))
  })
  test('零值返回零串', () => {
    assert.equal(humanTime(new Date(0), 'none'), 'none')
  })
  test('humanTimeLower 小写', () => {
    const past = new Date(Date.now() - 65 * 1000)
    assert.equal(humanTimeLower(past), humanTime(past).toLowerCase())
  })
})