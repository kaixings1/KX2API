import { ProfileManager } from '../profiles/manager.ts'

const pm = new ProfileManager()

console.log('Global config path:', pm['getGlobalPath']())

try {
  const profiles = pm.list()
  console.log('Total profiles:', profiles.length)
  console.log('Active:', pm.getActive()?.name ?? 'none')

  for (const p of profiles) {
    console.log(
      `  [${p.name}] provider=${p.provider} baseUrl=${p.baseUrl} model=${p.model} ` +
      `apiKey=${p.apiKey.slice(0, 8)}... active=${p._active} source=${p._source}`
    )
  }

  const active = pm.getActive()
  console.log('\nActive profile:', active ? { name: active.name, baseUrl: active.baseUrl, model: active.model } : 'null')

  if (profiles.length > 0) {
    const first = profiles[0]
    const found = pm.get(first.name)
    console.log(`Get "${first.name}":`, found ? 'found' : 'not found')
  }

  console.log('\nAll ProfileManager tests PASSED')
} catch (e) {
  console.error('FAILED:', e)
  process.exit(1)
}
