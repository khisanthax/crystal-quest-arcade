CREATE TABLE game_master_badges (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 description TEXT NOT NULL,
 rarity TEXT NOT NULL,
 icon TEXT NOT NULL,
 active INTEGER NOT NULL CHECK (active IN (0, 1)),
 version INTEGER NOT NULL,
 updated INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE player_badges (
 account_id TEXT NOT NULL REFERENCES explorers(id),
 profile TEXT NOT NULL CHECK (profile IN ('emberia','luminara')),
 badge_id TEXT NOT NULL REFERENCES game_master_badges(id),
 awarded INTEGER NOT NULL,
 PRIMARY KEY (account_id,profile,badge_id)
);
