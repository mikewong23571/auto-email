import type { D1Database, D1Result } from "@cloudflare/workers-types";
import type { Message, Bindings } from "../types";

export const getDatabase = (env: Bindings): D1Database => {
  return env.DB;
};

export const insertMessage = async (db: D1Database, message: Message) => {
  return db
    .prepare(
      `INSERT INTO messages (id, to_addr, from_addr, subject, body_text, body_html, received_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      message.id,
      message.to_addr,
      message.from_addr,
      message.subject || "",
      message.body_text || "",
      message.body_html || "",
      message.received_at,
    )
    .run();
};

export const getMessages = async (
  db: D1Database,
  limit: number,
  offset: number,
  to?: string,
  search?: string,
) => {
  let query = `SELECT id, to_addr, from_addr, subject, received_at, 
                 length(body_html) > 0 as has_html, 
                 substr(body_text, 1, 200) as preview 
                 FROM messages`;
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (to) {
    conditions.push("to_addr = ?");
    params.push(to);
  }

  if (search) {
    // Use FTS
    query = `SELECT m.id, m.to_addr, m.from_addr, m.subject, m.received_at, 
                 length(m.body_html) > 0 as has_html, 
                 substr(m.body_text, 1, 200) as preview 
                 FROM messages m
                 JOIN messages_fts fts ON m.rowid = fts.rowid
                 WHERE messages_fts MATCH ?`;
    params.length = 0;
    params.push(search);
    if (to) {
      query += " AND m.to_addr = ?";
      params.push(to);
    }
  } else {
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
  }

  query += " ORDER BY received_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const result = await db
    .prepare(query)
    .bind(...params)
    .all();
  return result.results;
};

export const getMessageCount = async (
  db: D1Database,
  to?: string,
  search?: string,
): Promise<number> => {
  let query = "SELECT COUNT(*) as count FROM messages";
  const params: unknown[] = [];

  if (search) {
    query = `SELECT COUNT(*) as count FROM messages m
             JOIN messages_fts fts ON m.rowid = fts.rowid
             WHERE messages_fts MATCH ?`;
    params.push(search);
    if (to) {
      query += " AND m.to_addr = ?";
      params.push(to);
    }
  } else if (to) {
    query += " WHERE to_addr = ?";
    params.push(to);
  }

  const result = await db
    .prepare(query)
    .bind(...params)
    .first<{ count: number }>();
  return result?.count ?? 0;
};

export const getLatestMessages = async (db: D1Database, n: number, to: string) => {
  const result = await db
    .prepare("SELECT * FROM messages WHERE to_addr = ? ORDER BY received_at DESC LIMIT ?")
    .bind(to, n)
    .all();
  return result.results;
};

export const getMessage = async (db: D1Database, id: string) => {
  return db.prepare("SELECT * FROM messages WHERE id = ?").bind(id).first();
};

export const deleteMessage = async (db: D1Database, id: string) => {
  return db.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
};

export const deleteMessages = async (
  db: D1Database,
  ids: string[],
): Promise<{ changes: number }> => {
  if (ids.length === 0) return { changes: 0 };
  const placeholders = ids.map(() => "?").join(", ");
  const stmt = `DELETE FROM messages WHERE id IN (${placeholders})`;
  const res: D1Result = await db
    .prepare(stmt)
    .bind(...ids)
    .run();
  const changes = typeof res.meta?.changes === "number" ? res.meta.changes : ids.length;
  return { changes };
};
