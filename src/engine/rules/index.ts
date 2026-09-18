/**
 * engine/rules/index.ts — 规则引擎 barrel export
 */
export {
  evalCondition,
  evalConditionValue,
  type VarType,
  type ConditionValue,
  type OperatorConditionValue,
  type ConditionInterface,
  type TestedObj,
  type SavedGroupsValues,
  type Operator,
} from './mongrule.js'
