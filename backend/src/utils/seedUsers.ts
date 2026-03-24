import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const SEED_USERS = [
  { username: 'operator', password: '123456', role: 'operator', branchName: null },
  { username: 'branch', password: '123456', role: 'branch', branchName: '上海营业部' },
  { username: 'general', password: '123456', role: 'general_affairs', branchName: null },
];

export async function seedUsers(db: Database.Database): Promise<void> {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO users (id, username, password_hash, role, branch_name) VALUES (?, ?, ?, ?, ?)'
  );
  for (const u of SEED_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    insert.run(uuidv4(), u.username, hash, u.role, u.branchName);
  }
}
