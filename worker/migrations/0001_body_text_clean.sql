-- Add persisted Clean text field and rebuild FTS to index it.

ALTER TABLE messages ADD COLUMN body_text_clean TEXT;

DROP TRIGGER IF EXISTS messages_ai;
DROP TRIGGER IF EXISTS messages_ad;
DROP TRIGGER IF EXISTS messages_au;

DROP TABLE IF EXISTS messages_fts;

CREATE VIRTUAL TABLE messages_fts USING fts5(
  subject,
  body_text,
  body_text_clean,
  from_addr,
  to_addr,
  content='messages',
  content_rowid='rowid'
);

CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, subject, body_text, body_text_clean, from_addr, to_addr)
  VALUES (new.rowid, new.subject, new.body_text, new.body_text_clean, new.from_addr, new.to_addr);
END;

CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, body_text, body_text_clean, from_addr, to_addr)
  VALUES('delete', old.rowid, old.subject, old.body_text, old.body_text_clean, old.from_addr, old.to_addr);
END;

CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, body_text, body_text_clean, from_addr, to_addr)
  VALUES('delete', old.rowid, old.subject, old.body_text, old.body_text_clean, old.from_addr, old.to_addr);

  INSERT INTO messages_fts(rowid, subject, body_text, body_text_clean, from_addr, to_addr)
  VALUES (new.rowid, new.subject, new.body_text, new.body_text_clean, new.from_addr, new.to_addr);
END;

-- Rebuild index from existing rows
INSERT INTO messages_fts(messages_fts) VALUES('rebuild');

