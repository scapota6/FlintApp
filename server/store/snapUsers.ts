import fs from 'fs';
import path from 'path';

type Rec = { userId: string; userSecret: string };
type DB = Record<string, Rec>;

const DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DIR, 'snaptrade-users.json');

function ensure(){ 
  if(!fs.existsSync(DIR)) fs.mkdirSync(DIR,{recursive:true}); 
  if(!fs.existsSync(FILE)) fs.writeFileSync(FILE,'{}','utf8'); 
}

function read(): DB { 
  ensure(); 
  try { 
    return JSON.parse(fs.readFileSync(FILE,'utf8')) as DB; 
  } catch { 
    return {}; 
  } 
}

function write(db: DB){ 
  fs.writeFileSync(FILE, JSON.stringify(db,null,2), 'utf8'); 
}

export async function getSnapUser(userId: string){ 
  return read()[userId] || null; 
}

export async function saveSnapUser(rec: Rec){ 
  const db = read(); 
  db[rec.userId] = rec; 
  write(db); 
}

export async function deleteSnapUser(userId: string){
  const db = read();
  delete db[userId];
  write(db);
}