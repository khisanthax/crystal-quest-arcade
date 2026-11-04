CREATE TABLE game_master_snapshots (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES explorers(id),
 actor TEXT NOT NULL,
 revision INTEGER NOT NULL,
 digest TEXT NOT NULL,
 payload TEXT NOT NULL,
 created INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX game_master_snapshots_account ON game_master_snapshots(account_id, created DESC);
