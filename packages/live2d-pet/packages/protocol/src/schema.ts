/**
 * JSON Schema definitions for l2d.* protocol messages.
 * Used by transport layers (WS/STDIO) for runtime validation.
 */

import type {
  L2DType,
  ModelLoadPayload,
  ModelLoadedPayload,
  ExpressionSetPayload,
  ExpressionListPayload,
  ActionPerformPayload,
  ActionListPayload,
  HeartbeatPayload,
  SystemByePayload,
  ModelInfo,
} from './types.js'

// ── Internal helper ─────────────────────────────────

type JSONSchemaType<T> = Record<string, unknown> & { __brand?: T }

// ── Payload Schemas ─────────────────────────────────

export const ModelLoadPayloadSchema = {
  type: 'object',
  required: ['path'],
  properties: {
    path: { type: 'string', description: '模型目录绝对路径，包含 .model3.json' },
  },
  additionalProperties: false,
} satisfies JSONSchemaType<ModelLoadPayload>

export const ModelLoadedPayloadSchema = {
  type: 'object',
  required: ['ok'],
  properties: {
    ok: { type: 'boolean' },
    model: { type: 'string' },
    error: { type: 'string' },
  },
  additionalProperties: false,
} satisfies JSONSchemaType<ModelLoadedPayload>

export const ExpressionSetPayloadSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', description: '表情名称' },
  },
  additionalProperties: false,
} satisfies JSONSchemaType<ExpressionSetPayload>

export const ExpressionListPayloadSchema = {
  type: 'object',
  required: ['expressions'],
  properties: {
    expressions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          emoji: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  },
  additionalProperties: false,
} satisfies JSONSchemaType<ExpressionListPayload>

export const ActionPerformPayloadSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string' },
    intensity: { type: 'number', minimum: 0, maximum: 1 },
    count: { type: 'integer', minimum: 1 },
  },
  additionalProperties: false,
} satisfies JSONSchemaType<ActionPerformPayload>

export const ActionListPayloadSchema = {
  type: 'object',
  required: ['actions'],
  properties: {
    actions: { type: 'array', items: { type: 'string' } },
  },
  additionalProperties: false,
} satisfies JSONSchemaType<ActionListPayload>

export const HeartbeatPayloadSchema = {
  type: 'object',
  required: ['fps', 'idleMs'],
  properties: {
    fps: { type: 'number' },
    idleMs: { type: 'number' },
  },
  additionalProperties: false,
} satisfies JSONSchemaType<HeartbeatPayload>

export const SystemByePayloadSchema = {
  type: 'object',
  required: ['reason'],
  properties: {
    reason: { type: 'string' },
  },
  additionalProperties: false,
} satisfies JSONSchemaType<SystemByePayload>

export const ModelInfoSchema = {
  type: 'object',
  required: ['model', 'expressions', 'actions', 'parameters'],
  properties: {
    model: { type: 'string' },
    expressions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          emoji: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    actions: { type: 'array', items: { type: 'string' } },
    parameters: { type: 'array', items: { type: 'string' } },
  },
  additionalProperties: false,
} satisfies JSONSchemaType<ModelInfo>

// ── Payload Map ────────────────────────────────────

/** message type → JSON Schema for payload */
export const PAYLOAD_SCHEMAS: Partial<Record<L2DType, object>> = {
  'l2d.model.load': ModelLoadPayloadSchema,
  'l2d.model.loaded': ModelLoadedPayloadSchema,
  'l2d.expression.set': ExpressionSetPayloadSchema,
  'l2d.expression.done': {
    type: 'object', required: ['name', 'ok'],
    properties: { name: { type: 'string' }, ok: { type: 'boolean' }, error: { type: 'string' } },
    additionalProperties: false,
  },
  'l2d.expression.list': { type: 'object', additionalProperties: false },
  'l2d.action.perform': ActionPerformPayloadSchema,
  'l2d.action.done': {
    type: 'object', required: ['name', 'ok'],
    properties: { name: { type: 'string' }, ok: { type: 'boolean' }, error: { type: 'string' } },
    additionalProperties: false,
  },
  'l2d.action.list': { type: 'object', additionalProperties: false },
  'l2d.system.ready': ModelInfoSchema,
  'l2d.system.bye': SystemByePayloadSchema,
  'l2d.system.heartbeat': HeartbeatPayloadSchema,
}

/**
 * Validate payload against its schema.
 * Returns null if valid, or an error string if invalid.
 */
export function validatePayload(type: L2DType, _payload: unknown): string | null {
  const schema = PAYLOAD_SCHEMAS[type]
  if (!schema) return `unknown message type: ${type}`
  // TODO: integrate ajv for full JSON Schema validation
  return null
}
