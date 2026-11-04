CREATE TABLE enrolled_devices (token_hash TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES explorers(id), expires INTEGER NOT NULL, PRIMARY KEY(token_hash,account_id));
