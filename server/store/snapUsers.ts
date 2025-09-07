import fs from 'fs';
import path from 'path';
type Rec = { userId: string; userSecret: string };
type DB = Record<string, Rec>;
const DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DIR, 'snaptrade-users.json');

function ensure(){ if(!fs.existsSync(DIR)) fs.mkdirSync(DIR,{recursive:true}); if(!fs.existsSync(FILE)) fs.writeFileSync(FILE,'{}','utf8'); }
function read(): DB { ensure(); try { return JSON.parse(fs.readFileSync(FILE,'utf8')) as DB; } catch { return {}; } }
function write(db: DB){ fs.writeFileSync(FILE, JSON.stringify(db,null,2), 'utf8'); }

export async function getSnapUser(flintUserId: string){ 
  const db = read();
  // Look for entry by Flint user ID (the key) 
  return db[flintUserId] || null; 
}

export async function saveSnapUser(rec: Rec & { flintUserId?: string }){ 
  const db = read(); 
  // Use flintUserId as key if provided, otherwise use userId
  const key = rec.flintUserId || rec.userId;
  db[key] = rec; 
  write(db); 
}

export async function deleteSnapUser(flintUserId: string){ 
  const db = read(); 
  delete db[flintUserId]; 
  write(db); 
}