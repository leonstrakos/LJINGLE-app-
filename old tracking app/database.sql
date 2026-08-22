create database tracker;
use tracker;


CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50),
  email VARCHAR(100),
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  type ENUM('book','game','movie','tv'),
  title VARCHAR(255),
  status ENUM('completed','watching','dropped','later'),
  rating ENUM('enjoyed','okay','regret'),
  favorite BOOLEAN DEFAULT FALSE,
  completion_date DATE,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE games (
  media_id INT PRIMARY KEY,
  platform VARCHAR(100),
  playtime_minutes INT,
  completion_type ENUM('finished','quit','played','list'),
  FOREIGN KEY (media_id) REFERENCES media(id)
);  

CREATE TABLE books (
  media_id INT PRIMARY KEY,
  pages INT,
  progress_percent INT,
  FOREIGN KEY (media_id) REFERENCES media(id)
);


CREATE TABLE movies_tv (
  media_id INT PRIMARY KEY,
  duration_minutes INT,
  FOREIGN KEY (media_id) REFERENCES media(id)
);

CREATE TABLE topics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  name VARCHAR(100)
);

CREATE TABLE time_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  media_id INT NULL,
  topic_id INT NULL,
  activity_type VARCHAR(50),
  start_time DATETIME,
  end_time DATETIME,
  duration_minutes INT,
  FOREIGN KEY (media_id) REFERENCES media(id),
  FOREIGN KEY (topic_id) REFERENCES topics(id)
);