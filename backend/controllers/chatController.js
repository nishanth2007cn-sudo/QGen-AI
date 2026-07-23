const db = require('../config/db');

function getChats(req, res) {
  const database = db.getDb();
  res.json(database.chats || []);
}

function sendMessage(req, res) {
  const database = db.getDb();
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

  database.chats = database.chats || [];
  database.chats.push({ sender: 'user', message: message.trim(), timestamp: new Date().toISOString() });

  const reply = `Great question about "${message.slice(0, 100)}"! Here's what I can help with:\n\n` +
    `- **Break it down**: Start by understanding the input/output requirements.\n` +
    `- **Choose the right approach**: Consider different algorithms and data structures.\n` +
    `- **Test thoroughly**: Check edge cases and verify your solution.\n\n` +
    `Would you like me to generate some practice questions on this topic? Try the Generator!`;

  database.chats.push({ sender: 'ai', message: reply, timestamp: new Date().toISOString() });
  db.save();
  res.json({ reply, timestamp: new Date().toISOString() });
}

function clearChats(req, res) {
  const database = db.getDb();
  database.chats = [];
  db.save();
  res.json({ success: true, message: 'Chat history cleared' });
}

module.exports = { getChats, sendMessage, clearChats };