const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'qgen-data.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return {
      nextId: 1,
      users: [],
      questions: [],
      bookmarks: [],
      exams: [],
      chats: [],
      searches: [],
      papers: [],
      savedQuestions: [],
      aiLogs: []
    };
  }
}
let db = load();

function save() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function nextId() {
  return db.nextId++;
}

function getDb() {
  return db;
}

function reloadDb() {
  db = load();
  return db;
}

module.exports = { load, save, nextId, getDb, reloadDb };
