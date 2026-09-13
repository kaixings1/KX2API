"use strict";
/**
 * 吸收式文本压缩器 — 库函数版
 *
 * 设计定位：作为字符串输出管线中的可插拔环节，在三个关键节点调用：
 *   ① 用户输入之后
 *   ② 注入工具/技能/提示词片段之后
 *   ③ 实际发送给 AI 之前的最后一次彻底压缩
 *
 * 核心能力：
 *   A. 连续重复吸收 —— 同一文本粘贴 N 次，保留 1 次
 *   B. 全局跨调用去重 —— 跨多次调用累积的重复工具定义、模板片段等
 *   C. 结构感知压缩 —— 对 JSON schema、工具定义、XML 标签等做结构化去重
 *   D. 行级快速通道 —— 轻量路径，适合高频调用场景
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionCompressor = void 0;
exports.getSessionCompressor = getSessionCompressor;
exports.absorbText = absorbText;
exports.absorbQuick = absorbQuick;
const DEFAULTS = {
    minRepeat: 2,
    minBlockSize: 30,
    similarityThreshold: 0.88,
    consecutive: true,
    globalDedup: true,
    structural: true,
    lines: true,
    minRepeatLines: 3,
    annotate: false,
    maxCacheSize: 2000,
};
// ==================== 文本原语 ====================
function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    }
    return h.toString(36);
}
function normalize(s) {
    return s
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim()
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n');
}
function normForCompare(s) {
    // 比 normalize 更激进：去掉所有空白，只保留内容字符用于哈希比较
    return s.replace(/\s+/g, '').toLowerCase();
}
// ==================== 相似度计算 ====================
function quickSim(a, b) {
    if (a === b)
        return 1;
    if (!a || !b)
        return 0;
    // 短文本：直接 LCS
    if (a.length <= 300 && b.length <= 300)
        return lcsSim(a, b);
    // 长文本：前缀 + shingles 抽样
    const samples = 16;
    const segLen = Math.min(200, Math.floor(a.length / samples), Math.floor(b.length / samples));
    if (segLen <= 0)
        return 0;
    let score = 0;
    for (let i = 0; i < samples; i++) {
        const pA = Math.floor((a.length / samples) * i);
        const pB = Math.floor((b.length / samples) * i);
        const sA = a.substring(pA, pA + segLen);
        const sB = a.substring(pB, pB + segLen);
        score += jaccardShingles(sA, sB, 5);
    }
    return score / samples;
}
function lcsSim(a, b) {
    const m = a.length, n = b.length;
    if (m === 0 || n === 0)
        return 0;
    const rows = m + 1;
    // 用一维数组模拟，节省内存
    let prev = new Uint16Array(rows);
    let curr = new Uint16Array(rows);
    for (let i = 1; i <= n; i++) {
        for (let j = 0; j < rows; j++) {
            if (j === 0) {
                curr[0] = 0;
                continue;
            }
            if (b[i - 1] === a[j - 1])
                curr[j] = prev[j - 1] + 1;
            else
                curr[j] = Math.max(prev[j], curr[j - 1]);
        }
        [prev, curr] = [curr, prev];
    }
    return (2 * prev[m]) / (m + n);
}
function jaccardShingles(a, b, k) {
    const setA = new Set();
    const setB = new Set();
    for (let i = 0; i <= a.length - k; i++)
        setA.add(a.substring(i, i + k));
    for (let i = 0; i <= b.length - k; i++)
        setB.add(a.substring(i, i + k));
    let inter = 0;
    for (const s of setA) {
        if (setB.has(s))
            inter++;
    }
    const total = setA.size + setB.size;
    return total === 0 ? 0 : (2 * inter) / total;
}
/** 从文本中提取结构化片段 */
function extractSegments(text) {
    const segments = [];
    const lines = text.split('\n');
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        // 1) 工具定义块
        const toolMatch = detectToolBlock(lines, i);
        if (toolMatch) {
            segments.push({
                text: toolMatch.text,
                normalized: normForCompare(toolMatch.text),
                fingerprint: hash(normForCompare(toolMatch.text)),
                type: 'tool',
            });
            i = toolMatch.endLine;
            continue;
        }
        // 2) 代码块
        const codeMatch = line.match(/^(`{3,}|~{3,})/);
        if (codeMatch) {
            const fence = codeMatch[1];
            let end = i + 1;
            while (end < lines.length && !lines[end].startsWith(fence))
                end++;
            const block = lines.slice(i, end + 1).join('\n');
            segments.push({
                text: block,
                normalized: normForCompare(block),
                fingerprint: hash(normForCompare(block)),
                type: 'codeblock',
            });
            i = end + 1;
            continue;
        }
        // 3) XML 标签块
        const xmlMatch = detectXmlBlock(lines, i);
        if (xmlMatch) {
            segments.push({
                text: xmlMatch.text,
                normalized: normForCompare(xmlMatch.text),
                fingerprint: hash(normForCompare(xmlMatch.text)),
                type: 'xml',
            });
            i = xmlMatch.endLine;
            continue;
        }
        // 4) JSON schema / 对象块
        const jsonMatch = detectJsonBlock(lines, i);
        if (jsonMatch) {
            segments.push({
                text: jsonMatch.text,
                normalized: normForCompare(jsonMatch.text),
                fingerprint: hash(normForCompare(jsonMatch.text)),
                type: 'schema',
            });
            i = jsonMatch.endLine;
            continue;
        }
        // 5) 普通段落
        const para = collectParagraph(lines, i);
        if (para.text.trim().length > 0) {
            segments.push({
                text: para.text,
                normalized: normForCompare(para.text),
                fingerprint: hash(normForCompare(para.text)),
                type: 'paragraph',
            });
        }
        i = para.endLine;
    }
    return segments;
}
/** 检测工具定义块 */
function detectToolBlock(lines, start) {
    let depth = 0;
    let started = false;
    let braceStart = -1;
    for (let i = start; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (/^\s*"tools"\s*:/.test(trimmed) || /^\s*tools\s*[:=]/.test(trimmed)) {
            started = true;
            braceStart = i;
            depth = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
            continue;
        }
        if (/^\{\s*$/.test(trimmed) && !started) {
            let hasToolFields = false;
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                if (/"(name|description|parameters|input_schema|type)"\s*:/.test(lines[j].trim())) {
                    hasToolFields = true;
                    break;
                }
                if (lines[j].trim() === '}')
                    break;
            }
            if (hasToolFields) {
                started = true;
                braceStart = i;
                depth = 1;
                continue;
            }
        }
        if (started) {
            depth += (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
            if (depth <= 0) {
                const text = lines.slice(braceStart, i + 1).join('\n');
                if (text.length > 50)
                    return { text, endLine: i + 1 };
                return null;
            }
        }
        if (i - start > 100)
            return null;
    }
    return null;
}
/** 检测 XML 标签块 */
function detectXmlBlock(lines, start) {
    for (let i = start; i < Math.min(start + 3, lines.length); i++) {
        const trimmed = lines[i].trim();
        if (/^<\w+[^>]*>/.test(trimmed)) {
            const tagName = trimmed.match(/^<(\w+)/)?.[1];
            if (tagName) {
                const closeTag = `</${tagName}>`;
                for (let j = i + 1; j < Math.min(i + 200, lines.length); j++) {
                    if (lines[j].trim() === closeTag || lines[j].trim().startsWith('</')) {
                        return { text: lines.slice(i, j + 1).join('\n'), endLine: j + 1 };
                    }
                }
            }
        }
    }
    return null;
}
/** 检测 JSON 块 */
function detectJsonBlock(lines, start) {
    for (let i = start; i < Math.min(start + 5, lines.length); i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            let depth = 0;
            let began = false;
            for (let j = i; j < Math.min(i + 200, lines.length); j++) {
                const t = lines[j].trim();
                if (!began && t.length > 0)
                    began = true;
                if (began) {
                    depth += (t.match(/[\[{]/g) || []).length - (t.match(/[\]}]/g) || []).length;
                    if (depth <= 0) {
                        const text = lines.slice(i, j + 1).join('\n');
                        if (text.length > 30)
                            return { text, endLine: j + 1 };
                        return null;
                    }
                }
            }
        }
    }
    return null;
}
/** 收集连续段落 */
function collectParagraph(lines, start) {
    let end = start;
    while (end < lines.length && lines[end].trim() !== '') {
        end++;
    }
    return {
        text: lines.slice(start, end).join('\n'),
        endLine: end,
    };
}
// ==================== 会话级压缩器 ====================
/** 创建会话级压缩器实例 */
function getSessionCompressor(opts) {
    return new SessionCompressor(opts);
}
class SessionCompressor {
    constructor(opts = {}) {
        this.cache = new Map();
        this.stats = {
            consecutive: 0,
            globalDedup: 0,
            structural: 0,
            lines: 0,
            cacheHits: 0,
        };
        this.opts = { ...DEFAULTS, ...opts };
    }
    /** 输入后调用 — 轻量 */
    feed(text) {
        return this.compress(text, { structural: false, globalDedup: false });
    }
    /** 注入工具后调用 — 注册到缓存 */
    inject(text) {
        return this.compress(text, { structural: true, globalDedup: false, lines: false });
    }
    /** 发送前调用 — 最彻底 */
    finalize(text) {
        return this.compress(text, { structural: true, globalDedup: true, lines: true });
    }
    /** 通用压缩（内部） */
    compress(text, overrides = {}) {
        return this.compressWithStats(text, overrides).text;
    }
    compressWithStats(text, overrides = {}) {
        const opts = { ...this.opts, ...overrides };
        let result = text;
        const stats = { ...this.stats };
        // ---- Pass 1: 行级快速吸收 ----
        if (opts.lines) {
            const r = absorbLinesPass(result, opts.minRepeatLines, opts.annotate);
            result = r.text;
            stats.lines += r.removed;
        }
        // ---- Pass 2: 结构化提取 + 注册到缓存 ----
        let segments = [];
        if (opts.structural) {
            segments = extractSegments(result);
            for (const seg of segments) {
                if (seg.type !== 'paragraph' && seg.text.length >= 100) {
                    this.cache.set(seg.fingerprint, seg.text);
                }
            }
        }
        // ---- Pass 3: 连续重复吸收 ----
        if (opts.consecutive) {
            const r = absorbConsecutive(result, opts.minRepeat, opts.annotate);
            result = r.text;
            stats.consecutive += r.removed;
        }
        // ---- Pass 4: 全局去重（含会话缓存） ----
        if (opts.globalDedup && segments.length > 0) {
            const r = dedupSegments(segments, opts, this.cache);
            result = r.text;
            stats.globalDedup += r.removed;
            stats.cacheHits += r.cacheHits;
            this.pruneCache();
        }
        this.stats = stats;
        const originalSize = text.length;
        const compressedSize = result.length;
        const saved = originalSize - compressedSize;
        return {
            text: result,
            originalSize,
            compressedSize,
            saved,
            ratio: originalSize > 0 ? saved / originalSize : 0,
            stats,
        };
    }
    /** 重置会话缓存 */
    reset() {
        this.cache.clear();
        this.stats = { consecutive: 0, globalDedup: 0, structural: 0, lines: 0, cacheHits: 0 };
    }
    /** 获取累计统计 */
    getStats() {
        return { ...this.stats };
    }
    /** 手动注册已知重复项 */
    register(text) {
        const fp = hash(normForCompare(text));
        this.cache.set(fp, text);
        this.pruneCache();
    }
    pruneCache() {
        if (this.cache.size > this.opts.maxCacheSize) {
            const entries = Array.from(this.cache.entries());
            const drop = Math.floor(this.opts.maxCacheSize * 0.2);
            for (let i = 0; i < drop; i++) {
                this.cache.delete(entries[i][0]);
            }
        }
    }
}
exports.SessionCompressor = SessionCompressor;
// ==================== 各 Pass 实现 ====================
/** Pass 1: 行级吸收 */
function absorbLinesPass(text, minRepeat, annotate) {
    const lines = text.split('\n');
    const out = [];
    let removed = 0;
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        // 空行不参与重复检测
        if (trimmed === '') {
            out.push(line);
            i++;
            continue;
        }
        // 计算当前行的连续重复次数
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === trimmed) {
            j++;
        }
        const repeatCount = j - i;
        if (repeatCount >= minRepeat) {
            // 保留首行 + 标注
            out.push(line);
            if (annotate) {
                out.push(`<!-- [重复 ${repeatCount} 次，已压缩 ${repeatCount - 1} 次] -->`);
            }
            removed += repeatCount - 1;
            i = j;
        }
        else {
            // 不足 minRepeat，全部保留
            for (let k = i; k < j; k++) {
                out.push(lines[k]);
            }
            i = j;
        }
    }
    return { text: out.join('\n'), removed };
}
/** Pass 3: 连续块吸收（基于正则分块） */
function absorbConsecutive(text, minRepeat, annotate) {
    const chunks = splitChunks(text);
    const out = [];
    let removed = 0;
    let i = 0;
    while (i < chunks.length) {
        const group = [chunks[i]];
        const norm0 = normForCompare(chunks[i]);
        let j = i + 1;
        while (j < chunks.length && normForCompare(chunks[j]) === norm0) {
            group.push(chunks[j]);
            j++;
        }
        if (group.length >= minRepeat) {
            out.push(group[0]);
            if (group.length > 1 && annotate) {
                out.push(`<!-- [重复 ${group.length} 次] -->`);
            }
            removed += group.length - 1;
        }
        else {
            out.push(...group);
        }
        i = j;
    }
    return { text: out.join('\n\n'), removed };
}
/** 将文本按双换行分隔切成块 */
function splitChunks(text) {
    return text
        .split(/\n{2,}/)
        .map(c => c.trim())
        .filter(c => c.length > 0);
}
/** Pass 4: 全局去重（使用会话缓存 + 片段级比较） */
function dedupSegments(segments, opts, cache) {
    const threshold = opts.similarityThreshold;
    const minSize = opts.minBlockSize;
    let removed = 0;
    let cacheHits = 0;
    const seenNorm = new Map();
    const keepFlags = new Array(segments.length).fill(true);
    for (let idx = 0; idx < segments.length; idx++) {
        const seg = segments[idx];
        // 太小的块跳过（保留）
        if (seg.text.length < minSize)
            continue;
        // 精确匹配：缓存命中
        if (cache.has(seg.fingerprint)) {
            keepFlags[idx] = false;
            removed++;
            cacheHits++;
            continue;
        }
        // 相似匹配（只对代码块/tool/schema做）
        if (seg.type !== 'paragraph' && seg.text.length >= minSize * 2) {
            let foundSimilar = false;
            for (const [norm, existing] of seenNorm) {
                const sim = quickSim(seg.normalized, norm);
                if (sim >= threshold) {
                    keepFlags[idx] = false;
                    removed++;
                    foundSimilar = true;
                    break;
                }
            }
            if (!foundSimilar) {
                seenNorm.set(seg.normalized, seg);
            }
        }
    }
    // 重建文本：保留原始顺序，只跳过被标记移除的段
    const outParts = [];
    for (let idx = 0; idx < segments.length; idx++) {
        if (keepFlags[idx]) {
            outParts.push(segments[idx].text);
        }
    }
    const text = outParts.join('\n\n');
    return { text, removed, cacheHits };
}
// ==================== 便捷无状态函数 ====================
/** 单次调用压缩（最简接口） */
function absorbText(text, opts) {
    const o = { ...DEFAULTS, ...opts };
    let result = text;
    if (o.lines) {
        result = absorbLinesPass(result, o.minRepeatLines, o.annotate).text;
    }
    if (o.consecutive) {
        result = absorbConsecutive(result, o.minRepeat, o.annotate).text;
    }
    if (o.structural || o.globalDedup) {
        const segments = extractSegments(result);
        if (segments.length > 1) {
            const cache = new Map();
            const r = dedupSegments(segments, o, cache);
            result = r.text;
        }
    }
    return result;
}
/** 快速行级压缩（开销最低，适合每个节点都用） */
function absorbQuick(text, minRepeat = 3) {
    return absorbLinesPass(text, minRepeat, false).text;
}
