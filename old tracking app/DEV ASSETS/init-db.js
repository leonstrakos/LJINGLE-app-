const db = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  email TEXT,
  password_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  type TEXT CHECK(type IN ('book','game','movie','tv')),
  title TEXT,
  status TEXT CHECK(status IN ('completed','watching','dropped','later')),
  rating TEXT CHECK(rating IN ('enjoyed','okay','regret')),
  favorite INTEGER DEFAULT 0,
  completion_date TEXT,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS games (
  media_id INTEGER PRIMARY KEY,
  platform TEXT,
  playtime_minutes INTEGER,
  completion_type TEXT CHECK(completion_type IN ('finished','quit','played','list')),
  FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS books (
  media_id INTEGER PRIMARY KEY,
  pages INTEGER,
  progress_percent INTEGER,
  FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS movies_tv (
  media_id INTEGER PRIMARY KEY,
  duration_minutes INTEGER,
  FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  media_id INTEGER,
  topic_id INTEGER,
  activity_type TEXT,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (media_id) REFERENCES media(id),
  FOREIGN KEY (topic_id) REFERENCES topics(id)
);
`);

console.log('Database initialized successfully.');