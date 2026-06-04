// ============================================================
// JSON-RPC 2.0 helpers — transport-agnostic (STDIO / SSE / WS)
// ============================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: number | string
  method: string
  params?: Record<string, unknown>
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export function parseRequest(line: string): JsonRpcRequest | null {
  try {
    const obj = JSON.parse(line.trim())
    if (obj.jsonrpc === '2.0' && typeof obj.method === 'string') {
      return obj as JsonRpcRequest
    }
    return null
  } catch {
    return null
  }
}

export function ok(id: number | string | undefined, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, result }
}

export function err(
  id: number | string | undefined,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, data } }
}

export function notification(method: string, params?: Record<string, unknown>): JsonRpcResponse {
  return { jsonrpc: '2.0', id: null, result: { method, params } }
}

// Standard JSON-RPC error codes
export const ErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const

export function format(response: JsonRpcResponse): string {
  return JSON.stringify(response)
}
