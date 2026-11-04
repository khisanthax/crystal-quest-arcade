CREATE TABLE explorers (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, pin_salt TEXT NOT NULL, pin_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, migrated INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES explorers(id), expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE devices (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES explorers(id), expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE attempt_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE save_requests (account_id TEXT NOT NULL REFERENCES explorers(id), request_id TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(account_id,request_id));
--> statement-breakpoint
CREATE TABLE wallet_transactions (account_id TEXT NOT NULL REFERENCES explorers(id), event_id TEXT NOT NULL, profile TEXT NOT NULL, detail TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(account_id,event_id));
--> statement-breakpoint
CREATE TABLE save_history (account_id TEXT NOT NULL REFERENCES explorers(id), revision INTEGER NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(account_id,revision));
