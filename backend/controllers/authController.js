const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const db = require('../config/db');

function register(req, res) {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const database = db.getDb();
  if (database.users.find(u => u.username === username.toLowerCase() || u.email === email.toLowerCase())) {
    return res.status(409).json({ error: 'Username or email already exists' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const user = {
    id: db.nextId(),
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    password: hashedPassword,
    isAdmin: database.users.length === 0,
    createdAt: new Date().toISOString()
  };
  database.users.push(user);
  db.save();

  const token = jwt.sign({ id: user.id, username: user.username, isAdmin: user.isAdmin }, config.jwtSecret, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin } });
}

function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const database = db.getDb();
  const user = database.users.find(u => u.username === username.toLowerCase() || u.email === username.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, isAdmin: user.isAdmin }, config.jwtSecret, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin } });
}

function getProfile(req, res) {
  const database = db.getDb();
  const user = database.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin, createdAt: user.createdAt });
}

function updateProfile(req, res) {
  const database = db.getDb();
  const user = database.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (req.body.email) user.email = req.body.email.toLowerCase();
  if (req.body.password) user.password = bcrypt.hashSync(req.body.password, 10);
  if (req.body.username) user.username = req.body.username.toLowerCase();
  db.save();
  res.json({ success: true, message: 'Profile updated' });
}

module.exports = { register, login, getProfile, updateProfile };