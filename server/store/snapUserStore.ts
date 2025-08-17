import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'snaptrade-users.json');

type Rec = { userId: string; snaptrade_user_secret: string };
type DB = Record<string, Rec>;

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({}), 'utf8');
}

function readDB(): DB {
  ensureFile();
  const raw = fs.readFileSync(FILE, 'utf8');
  try { return JSON.parse(raw) as DB; } catch { return {}; }
}

function writeDB(db: DB) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf8');
}

export async function getSnapUserByEmail(userId: string): Promise<Rec | null> {
  const db = readDB();
  const key = userId.toLowerCase();
  return db[key] || null;
}

export async function upsertSnapUserSecret(userId: string, secret: string): Promise<void> {
  const db = readDB();
  const key = userId.toLowerCase();
  db[key] = { userId: key, snaptrade_user_secret: secret };
  writeDB(db);
}

export async function deleteSnapUser(userId: string): Promise<void> {
  const db = readDB();
  const key = userId.toLowerCase();
  delete db[key];
  writeDB(db);
}