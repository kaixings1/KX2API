/**
 * LazyLoader — KX2API 适配版
 *
 * 从 doge-desktop src/performance/LazyLoader.ts 移植
 * 懒加载管理器，支持去重和预加载
 */

export interface LazyModule<T> {
  loaded: boolean
  module: T | null
  load: () => Promise<T>
}

export class LazyLoader {
  private modules: Map<string, LazyModule<any>> = new Map()
  private loadingPromises: Map<string, Promise<any>> = new Map()

  register<T>(name: string, loader: () => Promise<T>): void {
    this.modules.set(name, {
      loaded: false,
      module: null,
      load: async () => {
        if (this.loadingPromises.has(name)) {
          return this.loadingPromises.get(name)
        }

        const promise = loader().then((module) => {
          const lazyModule = this.modules.get(name)
          if (lazyModule) {
            lazyModule.loaded = true
            lazyModule.module = module
          }
          this.loadingPromises.delete(name)
          return module
        })

        this.loadingPromises.set(name, promise)
        return promise
      },
    })
  }

  async load<T>(name: string): Promise<T> {
    const lazyModule = this.modules.get(name)
    if (!lazyModule) {
      throw new Error(`Module ${name} not registered`)
    }

    if (lazyModule.loaded) {
      return lazyModule.module as T
    }

    return lazyModule.load() as Promise<T>
  }

  async preload(names: string[]): Promise<void> {
    await Promise.all(names.map((name) => this.load(name).catch(() => null)))
  }

  isLoaded(name: string): boolean {
    return this.modules.get(name)?.loaded || false
  }

  unload(name: string): void {
    const lazyModule = this.modules.get(name)
    if (lazyModule) {
      lazyModule.loaded = false
      lazyModule.module = null
    }
    this.loadingPromises.delete(name)
  }

  getLoadedModules(): string[] {
    const loaded: string[] = []
    for (const [name, mod] of this.modules.entries()) {
      if (mod.loaded) {
        loaded.push(name)
      }
    }
    return loaded
  }
}
