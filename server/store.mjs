import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export function createStore(path) {
 if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
 const db = new DatabaseSync(path);
 if (path !== ':memory:') chmodSync(path, 0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS inquiries (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
 category TEXT NOT NULL, message TEXT NOT NULL, notes TEXT NOT NULL,
 consent_at TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new'
 CHECK(status IN ('new','in_progress','closed')), idempotency_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS inquiries_created ON inquiries(created_at DESC);
 CREATE TABLE IF NOT EXISTS notifications (
 inquiry_id TEXT PRIMARY KEY REFERENCES inquiries(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT NOT NULL, sent_at TEXT, last_error TEXT);
 CREATE INDEX IF NOT EXISTS notifications_pending ON notifications(status, next_attempt_at);`);
 // Recover interrupted work. Run a single API process per database.
 db.prepare("UPDATE notifications SET status='pending' WHERE status='processing'").run();
 const insert = db.prepare('INSERT INTO inquiries (id,name,email,phone,category,message,notes,consent_at,created_at,idempotency_key,payload_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
 const publicFields = 'i.id,i.name,i.email,i.phone,i.category,i.message,i.notes,i.consent_at,i.created_at,i.status,n.status AS notification_status,n.attempts AS notification_attempts';
 return {
  db,
  create(data, key) {
   const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
   const existing = db.prepare('SELECT id,payload_hash FROM inquiries WHERE idempotency_key=?').get(key);
   if (existing) return existing.payload_hash === hash ? { id: existing.id, duplicate: true } : { conflict: true };
   const id = randomUUID(), now = new Date().toISOString();
   db.exec('BEGIN IMMEDIATE');
   try { insert.run(id,data.name,data.email,data.phone,data.category,data.message,data.notes,now,now,key,hash);db.prepare('INSERT INTO notifications (inquiry_id,next_attempt_at) VALUES (?,?)').run(id,now);db.exec('COMMIT'); }
   catch (error) { db.exec('ROLLBACK');throw error; }
   return { id, duplicate: false };
  },
  list({ page, limit, status, search }) {
   const filters=[], values=[];
   if(status){filters.push('i.status=?');values.push(status);}
   if(search){filters.push("(i.name LIKE ? ESCAPE '\\' OR i.email LIKE ? ESCAPE '\\' OR i.category LIKE ? ESCAPE '\\')");const escaped=search.replace(/[\\%_]/g,'\\$&');values.push(...Array(3).fill(`%${escaped}%`));}
   const where=filters.length?' WHERE '+filters.join(' AND '):'';
   const total=db.prepare('SELECT count(*) AS count FROM inquiries i'+where).get(...values).count;
   const items=db.prepare(`SELECT ${publicFields} FROM inquiries i LEFT JOIN notifications n ON n.inquiry_id=i.id${where} ORDER BY i.created_at DESC,i.rowid DESC LIMIT ? OFFSET ?`).all(...values,limit,(page-1)*limit);
   const counts={new:0,in_progress:0,closed:0};for(const row of db.prepare('SELECT status,count(*) AS count FROM inquiries GROUP BY status').all())counts[row.status]=row.count;
   return {items,total,page,limit,counts};
  },
  setStatus(id,status){return db.prepare('UPDATE inquiries SET status=? WHERE id=?').run(status,id).changes>0;},
  delete(id){return db.prepare('DELETE FROM inquiries WHERE id=?').run(id).changes>0;},
  nextNotification(){return db.prepare(`SELECT ${publicFields} FROM inquiries i JOIN notifications n ON n.inquiry_id=i.id WHERE n.status='pending' AND n.attempts<5 AND n.next_attempt_at<=? ORDER BY i.created_at LIMIT 1`).get(new Date().toISOString());},
  claimNotification(id){return db.prepare("UPDATE notifications SET status='processing',attempts=attempts+1 WHERE inquiry_id=? AND status='pending'").run(id).changes>0;},
  sent(id){db.prepare("UPDATE notifications SET status='sent',sent_at=?,last_error=NULL WHERE inquiry_id=?").run(new Date().toISOString(),id);},
  failed(id,attempt){db.prepare("UPDATE notifications SET status=?,last_error='Delivery failed; see provider status',next_attempt_at=? WHERE inquiry_id=?").run(attempt>=5?'failed':'pending',new Date(Date.now()+Math.min(3600000,60000*2**attempt)).toISOString(),id);},
  retry(id){return db.prepare("UPDATE notifications SET status='pending',attempts=0,next_attempt_at=?,last_error=NULL WHERE inquiry_id=? AND status='failed'").run(new Date().toISOString(),id).changes>0;},
  close(){db.close();},
 };
}
