CREATE TABLE IF NOT EXISTS reading_admin (slot INTEGER PRIMARY KEY CHECK(slot=1), account_id TEXT NOT NULL REFERENCES explorers(id) ON DELETE CASCADE);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS reading_publications (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES explorers(id) ON DELETE CASCADE, profile TEXT NOT NULL CHECK(profile IN ('ari','kal')), payload TEXT NOT NULL, published INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS reading_publications_player ON reading_publications(account_id,profile);
