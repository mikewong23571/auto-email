-- D1 Schema

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,           -- UUID
    to_addr TEXT NOT NULL,
    from_addr TEXT NOT NULL,
    subject TEXT,
    body_text TEXT,
    body_text_clean TEXT,
    body_html TEXT,
    received_at INTEGER NOT NULL   -- Epoch seconds
);

-- Full Text Search Virtual Table
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    subject,
    body_text,
    body_text_clean,
    from_addr,
    to_addr,
    content='messages',
    content_rowid='rowid' -- D1/SQLite uses rowid implicitly
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, subject, body_text, body_text_clean, from_addr, to_addr) 
  VALUES (new.rowid, new.subject, new.body_text, new.body_text_clean, new.from_addr, new.to_addr);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, body_text, body_text_clean, from_addr, to_addr) 
  VALUES('delete', old.rowid, old.subject, old.body_text, old.body_text_clean, old.from_addr, old.to_addr);
END;

-- Allow derived-field backfills (e.g. body_text_clean) while keeping content immutable.
CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, body_text, body_text_clean, from_addr, to_addr)
  VALUES('delete', old.rowid, old.subject, old.body_text, old.body_text_clean, old.from_addr, old.to_addr);

  INSERT INTO messages_fts(rowid, subject, body_text, body_text_clean, from_addr, to_addr)
  VALUES (new.rowid, new.subject, new.body_text, new.body_text_clean, new.from_addr, new.to_addr);
END;
