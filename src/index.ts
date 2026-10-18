// SPDX-License-Identifier: MIT
// Thin MCP-over-HTTP client for the hosted agent_utils Swarm server: memory, mutex,
// task board, pub/sub, idempotency and webhook inbox, all on one endpoint.
// This is a client, not the service — see https://agent-utils.ai.
// Zero dependencies: uses the global `fetch` (Node 18+ or any modern runtime).

export interface AgentUtilsOptions {
  /** Bearer token. Any secret works — the first call auto-provisions a free trial. */
  token: string;
  /** Override the MCP endpoint (defaults to production; see `STAGING_ENDPOINT`). */
  endpoint?: string;
}

export const DEFAULT_ENDPOINT = "https://mcp.agent-utils.ai/swarm";
export const STAGING_ENDPOINT = "https://mcp-staging.agent-utils.ai/swarm";

type Args = Record<string, unknown>;

/** Client for the agent_utils Swarm MCP server. The same token works on both
 *  agent_utils servers (swarm and extensions) — see https://agent-utils.ai. */
export class AgentUtilsSwarm {
  private readonly token: string;
  private readonly endpoint: string;
  private id = 0;

  constructor(opts: AgentUtilsOptions) {
    this.token = opts.token;
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
  }

  /** Call any MCP tool by name and return its result. */
  async call<T = unknown>(name: string, args: Args = {}): Promise<T> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++this.id,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    if (!res.ok) {
      throw new Error(`agent_utils HTTP ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as { result?: T; error?: { message?: string } };
    if (body.error) throw new Error(`agent_utils: ${body.error.message ?? "unknown error"}`);
    return body.result as T;
  }

  // --- memory ---------------------------------------------------------------

  getMemory(namespace: string, key: string) {
    return this.call("get_memory", { namespace, key });
  }

  putMemory(
    namespace: string,
    key: string,
    valueJson: string,
    opts: { months?: number; tags?: string[]; priority?: number } = {},
  ) {
    return this.call("put_memory", { namespace, key, value_json: valueJson, ...opts });
  }

  /**
   * Update an existing entry. Errors if the key does not exist — use `putMemory`
   * to create. Tags are managed explicitly via `tagsToAdd` / `tagsToDelete`;
   * you are charged per tag operation whether or not the tag was present.
   */
  replaceMemory(
    namespace: string,
    key: string,
    valueJson: string,
    opts: {
      priority?: number;
      summary?: string;
      tagsToAdd?: string[];
      tagsToDelete?: string[];
    } = {},
  ) {
    const { tagsToAdd, tagsToDelete, ...rest } = opts;
    return this.call("replace_memory", {
      namespace,
      key,
      value_json: valueJson,
      ...rest,
      ...(tagsToAdd ? { tags_to_add: tagsToAdd } : {}),
      ...(tagsToDelete ? { tags_to_delete: tagsToDelete } : {}),
    });
  }

  /**
   * Add `months` to an existing entry's expiry. Bills kb-months at the current
   * stored size. Errors if the key does not exist or has already expired.
   */
  extendMemoryTtl(namespace: string, key: string, months: number) {
    return this.call("extend_memory_ttl", { namespace, key, months });
  }

  deleteMemory(namespace: string, key: string) {
    return this.call("delete_memory", { namespace, key });
  }

  listKeys(namespace: string) {
    return this.call("list_keys", { namespace });
  }

  listNamespaces() {
    return this.call("list_namespaces", {});
  }

  searchByTag(tag: string) {
    return this.call("search_by_tag", { tag });
  }

  topMemories(namespace: string, n: number) {
    return this.call("top_memories", { namespace, n });
  }

  // --- mutex ----------------------------------------------------------------

  acquireLock(args: Args = {}) {
    return this.call("acquire_lock", args);
  }

  releaseLock(args: Args = {}) {
    return this.call("release_lock", args);
  }

  extendLock(args: Args = {}) {
    return this.call("extend_lock", args);
  }

  checkLock(args: Args = {}) {
    return this.call("check_lock", args);
  }

  listActiveLocks(args: Args = {}) {
    return this.call("list_active_locks", args);
  }

  // --- task board -----------------------------------------------------------

  createTask(args: Args = {}) {
    return this.call("create_task", args);
  }

  getTask(args: Args = {}) {
    return this.call("get_task", args);
  }

  listTasks(args: Args = {}) {
    return this.call("list_tasks", args);
  }

  updateTask(args: Args = {}) {
    return this.call("update_task", args);
  }

  claimTask(args: Args = {}) {
    return this.call("claim_task", args);
  }

  completeTask(args: Args = {}) {
    return this.call("complete_task", args);
  }

  releaseTask(args: Args = {}) {
    return this.call("release_task", args);
  }

  deleteTask(args: Args = {}) {
    return this.call("delete_task", args);
  }

  listBoards(args: Args = {}) {
    return this.call("list_boards", args);
  }

  renewBoard(args: Args = {}) {
    return this.call("renew_board", args);
  }

  deleteBoard(args: Args = {}) {
    return this.call("delete_board", args);
  }

  // --- pub/sub --------------------------------------------------------------

  publish(args: Args = {}) {
    return this.call("publish", args);
  }

  /** Read messages; pass `wait_seconds` (max 20) to long-poll. */
  readTopic(args: Args = {}) {
    return this.call("read_topic", args);
  }

  renewMessage(args: Args = {}) {
    return this.call("renew_message", args);
  }

  listTopics(args: Args = {}) {
    return this.call("list_topics", args);
  }

  deleteTopic(args: Args = {}) {
    return this.call("delete_topic", args);
  }

  // --- idempotency ----------------------------------------------------------

  listOperationRules(args: Args = {}) {
    return this.call("list_operation_rules", args);
  }

  createOperationRule(args: Args = {}) {
    return this.call("create_operation_rule", args);
  }

  deleteOperationRule(args: Args = {}) {
    return this.call("delete_operation_rule", args);
  }

  acquireKey(args: Args = {}) {
    return this.call("acquire_key", args);
  }

  completeKey(args: Args = {}) {
    return this.call("complete_key", args);
  }

  failKey(args: Args = {}) {
    return this.call("fail_key", args);
  }

  checkKey(args: Args = {}) {
    return this.call("check_key", args);
  }

  cleanupOperationRules(args: Args = {}) {
    return this.call("cleanup_operation_rules", args);
  }

  // --- webhook inbox --------------------------------------------------------

  createInbox(args: Args = {}) {
    return this.call("create_inbox", args);
  }

  pollInbox(args: Args = {}) {
    return this.call("poll_inbox", args);
  }

  listInboxes(args: Args = {}) {
    return this.call("list_inboxes", args);
  }

  deleteInbox(args: Args = {}) {
    return this.call("delete_inbox", args);
  }

  configureInboxSettings(args: Args = {}) {
    return this.call("configure_inbox_settings", args);
  }

  cleanupExpired(args: Args = {}) {
    return this.call("cleanup_expired", args);
  }

  // --- account (also on extensions) -----------------------------------------

  getAccount() {
    return this.call("get_account", {});
  }

  listApiKeys(args: Args = {}) {
    return this.call("list_api_keys", args);
  }

  createApiKey(args: Args = {}) {
    return this.call("create_api_key", args);
  }

  revokeApiKey(args: Args = {}) {
    return this.call("revoke_api_key", args);
  }

  listPayments(args: Args = {}) {
    return this.call("list_payments", args);
  }

  settleBalance(args: Args = {}) {
    return this.call("settle_balance", args);
  }

  submitFeatureRequest(args: Args = {}) {
    return this.call("submit_feature_request", args);
  }

  submitExitFeedback(args: Args = {}) {
    return this.call("submit_exit_feedback", args);
  }
}
