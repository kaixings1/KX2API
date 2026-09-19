// 复现探测：两轮工具对话历史 → ensureToolResultPairing → messageNormalizer
// 看最终发给 stepfun 的 API 消息里 tool 消息是否都带 tool_call_id
import { TicketNormalizer, groupMessagesByApiRound } from '?!'
// 使用真实模块——直接 tsx 导入（下面的 import 会被替换）