ALTER TABLE explorers ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE explorers ADD COLUMN last_activity INTEGER;
--> statement-breakpoint
ALTER TABLE explorers ADD COLUMN recovery_expires INTEGER;
--> statement-breakpoint
CREATE TABLE game_master_requests (
 id TEXT PRIMARY KEY,
 actor TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 marker TEXT NOT NULL,
 result TEXT NOT NULL,
 created INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE game_master_audit (
 id INTEGER PRIMARY KEY,
 request_id TEXT NOT NULL REFERENCES game_master_requests(id),
 actor TEXT NOT NULL,
 account_id TEXT NOT NULL,
 profile TEXT,
 action TEXT NOT NULL,
 reason TEXT NOT NULL,
 previous TEXT NOT NULL,
 updated TEXT NOT NULL,
 created INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX game_master_audit_account ON game_master_audit(account_id, id DESC);
--> statement-breakpoint
CREATE TABLE game_master_packages (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 active INTEGER NOT NULL,
 payload TEXT NOT NULL,
 version INTEGER NOT NULL,
 updated INTEGER NOT NULL
);
