import fs from 'fs';
import path from 'path';

type Rec = { userId: string; userSecret: string };
type DB = Record<string, Rec>;

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'snaptrade-users.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({}), 'utf8');
}

function read(): DB { 
  ensure(); 
  try { 
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) as DB; 
  } catch { 
    return {}; 
  } 
}

function write(db: DB) { 
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf8'); 
}

export async function getUser(userId: string) { 
  return read()[userId] || null; 
}

export async function saveUser(rec: Rec) { 
  const db = read(); 
  db[rec.userId] = rec; 
  write(db); 
}

export async function deleteUserLocal(userId: string) { 
  const db = read(); 
  delete db[userId]; 
  write(db); 
}

// Legacy alias for compatibility
export const deleteLocal = deleteUserLocal;