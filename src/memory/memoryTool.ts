/**
 * 记忆工具处理器 - TypeScript 实现
 * 来源: anthropics/claude-cookbooks/tool_use/memory_tool.py
 *
 * 目录统一：默认落盘到记忆系统目录（resolveMemoryDir()，即
 * `<homedir>/.doge/projects/<编码项目根>/memory`），与
 * `src/engine/memory/memoryRecall.ts` / `memoryWriter.ts` 同一目录，
 * 使 `memory_*` 工具写入的记忆能被召回系统读到。`/memories` 仍作为
 * 模型的虚拟根契约保留，仅决定真实落盘位置的根被迁移。
 */

import * as fs from "fs";
import * as path from "path";
import { resolveMemoryDir } from "../engine/memory/memoryRecall.ts";

export type MemoryResult = { success: string } | { error: string };

export interface MemoryParams {
  command: string;
  path?: string;
  file_text?: string;
  old_str?: string;
  new_str?: string;
  insert_line?: number;
  insert_text?: string;
  view_range?: [number, number];
  old_path?: string;
  new_path?: string;
}

export class MemoryToolHandler {
  private basePath: string;
  private memoryRoot: string;

  /**
   * @param basePath 显式提供时作为传统 `<basePath>/memories` 根（测试用），
   *                 缺省时统一到记忆系统目录 `resolveMemoryDir()`。
   */
  constructor(basePath?: string) {
    const directory = basePath ? path.resolve(basePath) : null;
    this.basePath = directory ?? path.dirname(resolveMemoryDir());
    this.memoryRoot = directory
      ? path.join(directory, "memories")
      : resolveMemoryDir();
    try {
      fs.mkdirSync(this.memoryRoot, { recursive: true });
    } catch {
      /* 目录创建失败不阻塞构造；后续读写会带出真实错误 */
    }
  }

  /** 当前记忆落盘的绝对根目录（默认等于记忆系统的 resolveMemoryDir()） */
  get root(): string {
    return this.memoryRoot;
  }

  private validatePath(inputPath: string): string {
    if (!inputPath.startsWith("/memories")) {
      throw new Error("路径必须以 /memories 开头");
    }
    const relative = inputPath.slice("/memories".length).replace(/^\/+/, "");
    const fullPath = path.resolve(
      relative ? path.join(this.memoryRoot, relative) : this.memoryRoot
    );
    if (!fullPath.startsWith(path.resolve(this.memoryRoot))) {
      throw new Error("路径逃逸检测");
    }
    return fullPath;
  }

  execute(params: MemoryParams): MemoryResult {
    const { command } = params;
    try {
      switch (command) {
        case "view": return this.view(params);
        case "create": return this.create(params);
        case "str_replace": return this.strReplace(params);
        case "insert": return this.insert(params);
        case "delete": return this.delete_(params);
        case "rename": return this.rename(params);
        default: return { error: "未知命令: " + command };
      }
    } catch (e: any) {
      return { error: e.message };
    }
  }

  private view(params: MemoryParams): MemoryResult {
    const inputPath = params.path;
    if (!inputPath) return { error: "缺少 path" };
    try {
      const fullPath = this.validatePath(inputPath);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const items = fs.readdirSync(fullPath).filter(i => !i.startsWith("."));
        return { success: "目录: " + inputPath + "\n" + items.map(i => "- " + i).join("\n") };
      }
      const content = fs.readFileSync(fullPath, "utf-8");
      return { success: content };
    } catch (e: any) {
      return { error: "无法读取: " + e.message };
    }
  }

  private create(params: MemoryParams): MemoryResult {
    const inputPath = params.path;
    if (!inputPath) return { error: "缺少 path" };
    try {
      const fullPath = this.validatePath(inputPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, params.file_text || "", "utf-8");
      return { success: "已创建: " + inputPath };
    } catch (e: any) {
      return { error: "无法创建: " + e.message };
    }
  }

  private strReplace(params: MemoryParams): MemoryResult {
    const inputPath = params.path;
    if (!inputPath || params.old_str === undefined) return { error: "缺少参数" };
    try {
      const fullPath = this.validatePath(inputPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      const count = content.split(params.old_str).length - 1;
      if (count === 0) return { error: "未找到" };
      if (count > 1) return { error: "重复出现" };
      fs.writeFileSync(fullPath, content.replace(params.old_str, params.new_str || ""), "utf-8");
      return { success: "已替换" };
    } catch (e: any) {
      return { error: "替换失败: " + e.message };
    }
  }

  private insert(params: MemoryParams): MemoryResult {
    const inputPath = params.path;
    if (!inputPath || params.insert_line === undefined) return { error: "缺少参数" };
    try {
      const fullPath = this.validatePath(inputPath);
      const lines = fs.readFileSync(fullPath, "utf-8").split("\n");
      if (params.insert_line < 0 || params.insert_line > lines.length) return { error: "行号无效" };
      lines.splice(params.insert_line, 0, (params.insert_text || "").replace(/\n$/, ""));
      fs.writeFileSync(fullPath, lines.join("\n") + "\n", "utf-8");
      return { success: "已插入" };
    } catch (e: any) {
      return { error: "插入失败: " + e.message };
    }
  }

  private delete_(params: MemoryParams): MemoryResult {
    const inputPath = params.path;
    if (!inputPath) return { error: "缺少 path" };
    if (inputPath === "/memories") return { error: "不能删除根目录" };
    try {
      const fullPath = this.validatePath(inputPath);
      if (!fs.existsSync(fullPath)) return { error: "路径不存在" };
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) fs.unlinkSync(fullPath);
      else fs.rmSync(fullPath, { recursive: true });
      return { success: "已删除" };
    } catch (e: any) {
      return { error: "删除失败: " + e.message };
    }
  }

  private rename(params: MemoryParams): MemoryResult {
    if (!params.old_path || !params.new_path) return { error: "缺少参数" };
    try {
      const oldFull = this.validatePath(params.old_path);
      const newFull = this.validatePath(params.new_path);
      if (!fs.existsSync(oldFull)) return { error: "源路径不存在" };
      if (fs.existsSync(newFull)) return { error: "目标已存在" };
      fs.mkdirSync(path.dirname(newFull), { recursive: true });
      fs.renameSync(oldFull, newFull);
      return { success: "已重命名" };
    } catch (e: any) {
      return { error: "重命名失败: " + e.message };
    }
  }
}
export default MemoryToolHandler;
