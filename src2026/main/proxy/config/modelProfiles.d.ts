import { ToolCallFormat } from '../constants/signatures';
/**
 * 模型配置文件
 * 定义每个模型的特征，包括是否支持原生函数调用、首选格式等
 */
export interface ModelProfile {
    id: string;
    nativeFunctionCalling: boolean;
    preferredFormat: ToolCallFormat;
    parsingStrategy: 'legacy' | 'balanced';
    streamHandlerType: 'bracket' | 'xml' | 'anthropic' | 'json';
}
/**
 * 模型配置映射
 * 按模型ID定义配置
 */
export declare const MODEL_PROFILES: Record<string, ModelProfile>;
/**
 * 获取模型配置
 * @param model 模型名称
 * @param provider 提供商名称
 * @returns 模型配置
 */
export declare function getModelProfile(model: string, provider?: string): ModelProfile;
/**
 * 检查模型是否支持原生函数调用
 * @param model 模型名称
 * @param provider 提供商名称
 * @returns 是否支持原生函数调用
 */
export declare function isNativeFunctionCallingModel(model: string, provider?: string): boolean;
/**
 * 获取模型的首选工具调用格式
 * @param model 模型名称
 * @param provider 提供商名称
 * @returns 首选格式
 */
export declare function getPreferredFormat(model: string, provider?: string): ToolCallFormat;
/**
 * 获取模型的流式处理类型
 * @param model 模型名称
 * @param provider 提供商名称
 * @returns 流式处理类型
 */
export declare function getStreamHandlerType(model: string, provider?: string): 'bracket' | 'xml' | 'anthropic' | 'json';
/**
 * 获取模型的解析策略
 * @param model 模型名称
 * @param provider 提供商名称
 * @returns 解析策略
 */
export declare function getParsingStrategy(model: string, provider?: string): 'legacy' | 'balanced';
/**
 * 获取所有可用的模型ID
 */
export declare function getAvailableModelIds(): string[];
