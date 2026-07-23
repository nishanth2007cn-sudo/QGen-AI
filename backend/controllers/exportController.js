const db = require('../config/db');

function exportQuestionPDF(req, res) {
  const database = db.getDb();
  const q = database.questions.find(x => x.id === Number(req.params.id));
  if (!q) return res.status(404).json({ error: 'Question not found' });
  const txt = `${q.details?.title || 'Question'}\n${'='.repeat(50)}\n\n${q.details?.question || ''}\n\nAnswer: ${q.details?.answer || 'N/A'}\n\nExplanation: ${q.details?.explanation || 'N/A'}`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="question-${q.id}.txt"`);
  res.send(txt);
}

function exportExamPDF(req, res) {
  const database = db.getDb();
  const result = database.exams.find(x => x.id === Number(req.params.id));
  if (!result) return res.status(404).json({ error: 'Result not found' });
  let txt = `${result.title}\n${'='.repeat(50)}\n\nScore: ${result.score}%\nCorrect: ${result.correct}/${result.totalQuestions}\nTime: ${Math.floor(result.timeTaken / 60)}m ${result.timeTaken % 60}s\n\n---\n\n`;
  result.questions.forEach((q, i) => {
    txt += `Q${i + 1}: ${q.details?.question || ''}\nYour Answer: ${result.answers[q.id] || 'N/A'}\nCorrect: ${q.details?.answer || 'N/A'}\n\n`;
  });
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="exam-result-${result.id}.txt"`);
  res.send(txt);
}

function exportJSON(req, res) {
  const database = db.getDb();
  const { type } = req.query;
  let data = database.questions;
  if (type) data = data.filter(q => q.type === type);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="questions-export.json"');
  res.json(data);
}

function exportCSV(req, res) {
  const database = db.getDb();
  const { type } = req.query;
  let data = database.questions;
  if (type) data = data.filter(q => q.type === type);
  let csv = 'ID,Type,Difficulty,Topic,Question,Answer\n';
  data.forEach(q => {
    const question = (q.details?.question || '').replace(/"/g, '""');
    const answer = (q.details?.answer || 'N/A').replace(/"/g, '""');
    csv += `${q.id},"${q.type}","${q.difficulty}","${q.topic}","${question}","${answer}"\n`;
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="questions-export.csv"');
  res.send(csv);
}

module.exports = { exportQuestionPDF, exportExamPDF, exportJSON, exportCSV };