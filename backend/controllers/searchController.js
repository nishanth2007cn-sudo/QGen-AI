const db = require('../config/db');
const { generateSeed, buildQuestion, generateQuestions: generateQuestionsHelper } = require('./questionController');

function getSearchSuggestions(req, res) {
  const database = db.getDb();
  const query = (req.query.q || '').toLowerCase();
  const topics = [...new Set(database.questions.map(q => q.topic).filter(Boolean))];
  const suggestions = topics.filter(t => t.toLowerCase().includes(query)).slice(0, 6);
  const recent = (database.searches || []).slice(-4).reverse();
  res.json({ suggestions, recent, popular: ['Arrays', 'Python Basics', 'SQL Joins', 'Dynamic Programming', 'OOP Concepts'] });
}

function aiSearch(req, res) {
  const database = db.getDb();
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  database.searches = database.searches || [];
  database.searches.push(query);
  db.save();

  const answer = `## ${query}\n\nHere's a comprehensive explanation about **${query}**:\n\n` +
    `### Key Concepts\n- **${query}** is a fundamental topic in programming.\n` +
    `- Understanding it requires practice and building intuition.\n\n` +
    `### Approach\n1. Start with the basics and build up gradually.\n` +
    `2. Practice with small examples before tackling complex problems.\n` +
    `3. Review edge cases and optimize your solutions.\n\n` +
    `### Example\n\`\`\`\n// Simple example related to ${query}\nfunction example() {\n  // Your code here\n  return "Practice makes perfect!";\n}\n\`\`\`\n\n` +
    `### Related Topics\n- Data Structures\n- Algorithms\n- Problem Solving Techniques\n\n` +
    `> Keep practicing! Consistency is key to mastering programming concepts.`;

  res.json({ answer });
}

module.exports = { searchSuggestions, aiSearch };