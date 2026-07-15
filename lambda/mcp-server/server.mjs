/**
 * MCP (Model Context Protocol) JSON-RPC 2.0 dispatcher.
 *
 * Stateless — each Lambda invocation builds a server, handles one request, discards it.
 * Implements: initialize, tools/list, tools/call, ping.
 * Spec: https://modelcontextprotocol.io (protocol version 2025-06-18).
 */

export const PROTOCOL_VERSION = "2025-06-18";

const JSONRPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: "Parse error" },
  INVALID_REQUEST: { code: -32600, message: "Invalid request" },
  METHOD_NOT_FOUND: { code: -32601, message: "Method not found" },
  INVALID_PARAMS: { code: -32602, message: "Invalid params" },
  INTERNAL_ERROR: { code: -32603, message: "Internal error" },
};

/**
 * @param {any} id
 * @param {{ code: number, message: string, data?: any }} errorObj
 * @param {any} [data]
 */
function rpcError(id, { code, message }, data) {
  const error = data !== undefined ? { code, message, data } : { code, message };
  return { jsonrpc: "2.0", id: id ?? null, error };
}

/** @param {any} id @param {any} result */
function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

/** @param {any} zodShape */
function toJsonSchema(zodShape) {
  // Minimal zod→JSON-Schema projection for MCP tool input schemas.
  // We only use the subset MCP clients actually read: type, properties, required,
  // minLength, maxLength, minimum, maximum, default, description.
  if (zodShape && typeof zodShape.toJsonSchema === "function") {
    return zodShape.toJsonSchema();
  }
  return zodShape;
}

/**
 * Build a stateless MCP server from a list of tool definitions.
 *
 * A tool definition is: { name, description, inputSchema, handler }
 * - inputSchema is a plain JSON Schema object (MCP-native), NOT a Zod schema.
 * - handler({ arguments, context }) returns { content: [{ type, text }], isError?: boolean }.
 * @param {{ tools: any[], serverInfo: any }} opts
 */
export function buildMcpServer({ tools, serverInfo }) {
  const toolsByName = new Map(tools.map((/** @type {any} */ t) => [t.name, t]));

  /** @param {any} request @param {any} [context] */
  async function handle(request, context = {}) {
    if (!request || typeof request !== "object") {
      return rpcError(null, JSONRPC_ERRORS.INVALID_REQUEST);
    }
    // JSON-RPC 2.0 §4.1: a request without an "id" member is a notification and
    // MUST NOT receive a response, regardless of method name or validity.
    if (!Object.hasOwn(request, "id")) return null;

    if (request.jsonrpc !== "2.0") {
      return rpcError(request.id, JSONRPC_ERRORS.INVALID_REQUEST, "jsonrpc must be '2.0'");
    }
    const { id, method, params } = request;

    try {
      switch (method) {
        case "initialize":
          return rpcResult(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: serverInfo ?? { name: "alti-mcp", version: "1.0.0" },
            instructions:
              "Alti gives external AI clients access to Christian Perez's blog and the Alti agent. " +
              "Use search_blog to discover posts, get_blog_post to read full content, " +
              "and ask_alti to have a conversational exchange with the agent.",
          });

        case "tools/list":
          return rpcResult(id, {
            tools: tools.map((/** @type {any} */ t) => ({
              name: t.name,
              description: t.description,
              inputSchema: toJsonSchema(t.inputSchema),
            })),
          });

        case "tools/call": {
          const toolName = params?.name;
          const tool = toolName ? toolsByName.get(toolName) : null;
          if (!tool) {
            return rpcError(id, JSONRPC_ERRORS.INVALID_PARAMS, `Unknown tool: ${toolName}`);
          }
          const args = params?.arguments ?? {};
          const result = await tool.handler({ arguments: args, context });
          return rpcResult(id, result);
        }

        case "ping":
          return rpcResult(id, {});

        default:
          return rpcError(id, JSONRPC_ERRORS.METHOD_NOT_FOUND, `Unknown method: ${method}`);
      }
    } catch (err) {
      return rpcError(id, JSONRPC_ERRORS.INTERNAL_ERROR, err instanceof Error ? err.message : String(err));
    }
  }

  return { handle };
}

export { JSONRPC_ERRORS };
