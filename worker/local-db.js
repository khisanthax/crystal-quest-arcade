import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
const runStatement = Symbol('runStatement');
export class LocalD1 {
 constructor(path=':memory:'){this.queue=Promise.resolve();this.db=new DatabaseSync(path);this.db.exec('PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS cq_migrations(tag TEXT PRIMARY KEY);');for(const entry of JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8')).entries){const row=this.db.prepare('SELECT tag FROM cq_migrations WHERE tag=?').get(entry.tag);if(!row){this.db.exec(readFileSync(new URL('../drizzle/'+entry.tag+'.sql',import.meta.url),'utf8'));this.db.prepare('INSERT INTO cq_migrations(tag) VALUES (?)').run(entry.tag);}}}
 prepare(sql){const db=this.db;let values=[];const op={bind(...args){values=args;return op;},async first(){return db.prepare(sql).get(...values)||null;},async all(){return {results:db.prepare(sql).all(...values)};},[runStatement](){const r=db.prepare(sql).run(...values);return {success:true,meta:{changes:Number(r.changes)}};},async run(){return op[runStatement]();}};return op;}
 async batch(statements){const execute=()=>{this.db.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s[runStatement]());this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}};const result=this.queue.then(execute);this.queue=result.catch(()=>{});return result;}
 close(){this.db.close();}
}
export function localDatabase(){mkdirSync('.local',{recursive:true});return new LocalD1(process.env.CQ_DB_PATH||'.local/explorers.sqlite');}
