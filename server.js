/* QGen-AI: dependency-free local application server. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'data', 'qgen-data.json');
const pageRoutes = new Set(['dashboard','generator','exam','bookmarks','history','search','results','paper_generator','profile','settings','admin','login','register','forgot_password']);
const sampleTopics = ['Arrays', 'Strings', 'Recursion', 'SQL Joins', 'Data Structures'];

function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { nextId: 1, questions: [], bookmarks: [], exams: [], chats: [], searches: [] }; }
}
let db = load();
db.users = db.users || [];
function save() { fs.mkdirSync(path.dirname(DB_FILE), { recursive: true }); fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function id() { return db.nextId++; }
function json(res, body, status = 200) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(body)); }
function text(res, body, type = 'text/plain; charset=utf-8', status = 200) { res.writeHead(status, {'Content-Type':type}); res.end(body); }
function readBody(req) { return new Promise((resolve, reject) => { let raw=''; req.on('data', c => raw += c); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } }); }); }
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function questionFingerprint(value) {
  return crypto.createHash('sha256').update(String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).digest('hex');
}

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}
function passwordMatches(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const expected = passwordHash(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expected, 'hex'));
}

function makeQuestion(input, index) {
  const topic = String(input.topic || 'Programming fundamentals').trim();
  const language = input.language || input.lang || topic.split(' - ')[0] || 'Python';
  const noun = topic.replace(/^.*?-\s*/, '') || 'Programming fundamentals';
  const difficulty = ['Easy', 'Medium', 'Hard'].includes(input.difficulty) ? input.difficulty : 'Medium';
  const aliases = { 'multiple choice': 'mcq', output_prediction: 'prediction' };
  const type = aliases[String(input.type || 'mcq').toLowerCase()] || String(input.type || 'mcq').toLowerCase();
  const focus = (input.subtopic || ['edge cases', 'loop invariants', 'input validation', 'complexity trade-offs', 'test design', 'state transitions', 'boundary conditions', 'data representation'][index % 8]).trim();
  const rotation = Number.parseInt(crypto.createHash('sha1').update(`${Date.now()}-${index}-${Math.random()}`).digest('hex').slice(0, 8), 16);
  const contexts = ['a production telemetry pipeline', 'a technical interview', 'an online judge', 'a code-review exercise', 'a performance-sensitive service', 'a classroom assessment', 'a data-processing job', 'a debugging session'];
  const context = contexts[rotation % contexts.length];
  const common = {
    difficulty, language, topic: noun, subtopic: focus, estimated_time: difficulty === 'Easy' ? 4 : difficulty === 'Hard' ? 15 : 8,
    marks: difficulty === 'Easy' ? 2 : difficulty === 'Hard' ? 10 : 5,
    tags: [noun, focus, language, difficulty],
    hint: `State the invariant for ${focus} before selecting an implementation.`,
    explanation: `The answer should respect the constraints, explicitly handle boundary cases, and justify the chosen ${focus} strategy.`
  };
  let details;
  if (type === 'coding') {
    details = { ...common, title: `${noun}: ${focus} challenge`, question: `Write a ${language} program for ${context}: solve a ${noun} task focused on ${focus}. Return the required result for every valid input.`, constraints: 'Input size is up to 100,000. Validate empty and single-element inputs.', sample_input: '5\n2 4 1 3 5', sample_output: 'Expected result for the specified operation', hidden_test_cases: [{ input: '0', output: 'Valid empty-case result' }, { input: '1\n7', output: '7' }], answer: 'Provide a correct, efficient implementation.', algorithm: `Define the ${focus} invariant, process each input item once where possible, and verify the result.`, time_complexity: 'O(n)', space_complexity: 'O(1) or O(n), depending on the approach' };
  } else if (type === 'debugging') {
    const buggy = `function transform(values) {\n  const result = [];\n  for (let i = 0; i <= values.length; i++) result.push(values[i] * 2);\n  return result;\n}`;
    details = { ...common, title: `Debug ${focus} in ${language}`, question: `Find and fix the defect in this ${language} snippet for ${context}.\n\n${buggy}`, buggy_code: buggy, error_explanation: 'The loop includes values[values.length], which is outside the valid index range.', correct_solution: buggy.replace('i <= values.length', 'i < values.length'), answer: 'Change the loop condition to i < values.length.', time_complexity: 'O(n)', space_complexity: 'O(n)' };
  } else if (type === 'prediction') {
    const value = 3 + (rotation % 5);
    const code = `let total = 0;\nfor (let i = 1; i <= ${value}; i++) total += i;\nconsole.log(total);`;
    details = { ...common, title: `Predict output: ${focus}`, question: `What does this ${language} code print?\n\n${code}`, code_snippet: code, correct_output: String(value * (value + 1) / 2), answer: String(value * (value + 1) / 2), explanation: `The loop adds integers from 1 through ${value}; the sum is ${value * (value + 1) / 2}.` };
  } else if (type === 'theory') {
    details = { ...common, title: `${noun}: explain ${focus}`, question: `Explain ${focus} in ${noun}. Relate it to ${context}, give a concrete ${language} example, and discuss its trade-offs.`, answer: 'A complete answer defines the concept, explains why it matters, gives an example, and covers limitations.', learning_outcomes: ['Explain the concept', 'Apply it to a realistic scenario', 'Evaluate trade-offs'] };
  } else {
    const options = ['Validate constraints and maintain a clear invariant', 'Assume all inputs are ideal and skip edge cases', 'Use the slowest approach without measuring it', 'Copy an unrelated solution'];
    details = { ...common, title: `${noun}: ${focus} MCQ`, question: `For ${context}, which practice best improves a ${noun} solution focused on ${focus}?`, options, answer: 'A', correct_answer: 'A', explanation: 'Clear constraints and an explicit invariant make correctness testable and prevent common edge-case failures.' };
  }
  return { id: id(), topic, subtopic: input.subtopic || focus, company: input.company || '', type: ['mcq','coding','debugging','prediction','theory'].includes(type) ? type : 'mcq', created_at: new Date().toISOString(), details };
}

function analytics() {
  const now = Date.now(), day = 86400000;
  const recent = db.questions.filter(q => now - new Date(q.created_at).getTime() < day);
  const weekly = db.questions.filter(q => now - new Date(q.created_at).getTime() < 7 * day);
  const scores = db.exams.map(x => x.score);
  const accuracy = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0) / scores.length) : 0;
  const topics = [...new Set(db.questions.map(q => q.topic.replace(/^.*?-\s*/, '')))].slice(0, 5);
  return { total_questions: db.questions.length, daily_count: recent.length, weekly_count: weekly.length, avg_accuracy: accuracy,
    current_streak: db.questions.length ? 1 : 0, longest_streak: db.questions.length ? 1 : 0, bookmarks_count: db.bookmarks.length,
    strong_topics: topics.slice(0, 3), weak_topics: topics.slice(3), company_readiness: [...new Set(db.questions.map(q=>q.company).filter(Boolean))].map(company => ({company, readiness: Math.min(100, 35 + db.questions.filter(q=>q.company===company).length * 10)})),
    timeline_labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], timeline_data: [0,0,0,0,0,0,weekly.length],
    difficulty_dist: ['Easy','Medium','Hard'].reduce((out, d) => (out[d] = db.questions.filter(q=>q.details.difficulty===d).length, out), {}),
    categories: topics.length ? topics : sampleTopics, counts: topics.length ? topics.map(t=>db.questions.filter(q=>q.topic.includes(t)).length) : [0,0,0,0,0],
    badges: db.questions.length ? [{name:'First steps', icon:'fa-rocket', desc:'Generated your first practice set'}] : [],
    activity_feed: db.questions.slice(-6).reverse().map(q => ({description:`Generated ${q.details.title}`, timestamp:new Date(q.created_at).toLocaleString()})) };
}

function examResultView(result) {
  const groups = { topics: {}, difficulties: {}, companies: {} };
  const questions = result.questions.map(question => {
    const details = question.details || {};
    const selected = result.answers[String(question.id)] || result.answers[question.id] || '';
    const correct = details.answer || details.correct_answer || '';
    const isCorrect = selected === correct;
    const add = (bucket, key) => {
      const name = key || 'General';
      bucket[name] = bucket[name] || { total: 0, correct: 0 };
      bucket[name].total++;
      if (isCorrect) bucket[name].correct++;
    };
    add(groups.topics, question.topic);
    add(groups.difficulties, details.difficulty);
    add(groups.companies, question.company);
    return {
      id: question.id, title: details.title || 'Question', question: details.question || '', options: details.options || [],
      correct_answer: correct, selected_answer: selected, explanation: details.explanation || '', hint: details.hint || '',
      difficulty: details.difficulty || 'Medium', topic: question.topic || 'General'
    };
  });
  const attempted = questions.filter(question => question.selected_answer).length;
  const accuracy = questions.length ? Number(((result.correct / questions.length) * 100).toFixed(1)) : 0;
  const grade = accuracy >= 90 ? 'A+' : accuracy >= 80 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 60 ? 'C' : accuracy >= 50 ? 'D' : 'F';
  return { ...result, total_questions: questions.length, attempted, skipped: questions.length - attempted, accuracy, grade, breakdown: groups, questions };
}

async function api(req, res, url) {
  const method = req.method, pathname = url.pathname;
  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await readBody(req); const username = String(body.username || '').trim(); const email = String(body.email || '').trim().toLowerCase(); const password = String(body.password || '');
    if (username.length < 3 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return json(res, { error: 'Use a username of 3+ characters, a valid email, and a password of 8+ characters.' }, 400);
    if (db.users.some(user => user.email === email || user.username.toLowerCase() === username.toLowerCase())) return json(res, { error: 'That username or email is already registered.' }, 409);
    const user = { id: id(), username, email, password_hash: passwordHash(password), created_at: new Date().toISOString() }; db.users.push(user); save();
    return json(res, { user: { id: user.id, username, email }, token: crypto.randomBytes(24).toString('hex') }, 201);
  }
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await readBody(req); const identity = String(body.identity || body.username || '').trim().toLowerCase(); const user = db.users.find(candidate => candidate.email === identity || candidate.username.toLowerCase() === identity);
    if (!user || !passwordMatches(body.password, user.password_hash)) return json(res, { error: 'Invalid username/email or password.' }, 401);
    return json(res, { user: { id: user.id, username: user.username, email: user.email }, token: crypto.randomBytes(24).toString('hex') });
  }
  if (pathname === '/api/auth/forgot-password' && method === 'POST') { const body = await readBody(req); return json(res, { message: `If ${String(body.email || '').trim()} is registered, a reset link would be sent.` }); }
  if (pathname === '/api/generate' && method === 'POST') {
    const input = await readBody(req);
    const allowedTypes = new Set(['mcq', 'coding', 'debugging', 'prediction', 'output_prediction', 'theory', 'multiple choice']);
    if (!String(input.topic || '').trim()) return json(res, { error: 'Topic is required.' }, 400);
    if (!allowedTypes.has(String(input.type || 'mcq').toLowerCase())) return json(res, { error: 'Unsupported question type.' }, 400);
    const count = Math.max(1, Math.min(Number(input.count) || 1, 30));
    const known = new Set(db.questions.map(q => questionFingerprint(q.details && q.details.question)));
    const questions = [];
    for (let attempt = 0; questions.length < count && attempt < count * 12; attempt++) {
      const candidate = makeQuestion(input, attempt);
      const fingerprint = questionFingerprint(candidate.details.question);
      if (known.has(fingerprint)) continue;
      known.add(fingerprint);
      candidate.content_hash = fingerprint;
      questions.push(candidate);
    }
    if (questions.length < count) return json(res, { error: 'Could not generate enough distinct questions. Please change the topic or try again.' }, 409);
    db.questions.push(...questions);
    db.aiLogs = db.aiLogs || [];
    db.aiLogs.push({ id: id(), action: 'generate', count, type: input.type || 'mcq', seed: Date.now(), created_at: new Date().toISOString() });
    save();
    return json(res, questions);
  }
  if (pathname === '/api/analytics') return json(res, analytics());
  if (pathname === '/api/bookmarks') {
    if (method === 'GET') { const folder=url.searchParams.get('folder'); return json(res, db.bookmarks.filter(b=>!folder || b.folder===folder).map(b => ({...b, ...(db.questions.find(q=>q.id===b.question_id) || {})}))); }
    const body=await readBody(req); if (method === 'POST') { if (!db.questions.some(q=>q.id===Number(body.question_id))) return json(res,{error:'Question not found'},404); if (!db.bookmarks.some(b=>b.question_id===Number(body.question_id))) db.bookmarks.push({id:id(),question_id:Number(body.question_id),folder:body.folder||'Favorites',bookmarked_at:new Date().toLocaleString()}); save(); return json(res,{success:true}); }
    if (method === 'DELETE') { db.bookmarks=db.bookmarks.filter(b=>b.question_id!==Number(body.question_id) && b.id!==Number(body.id)); save(); return json(res,{success:true}); }
  }
  if (pathname === '/api/history' && method === 'GET') return json(res, db.questions.slice().reverse().map(q => ({
    ...q,
    history_id: q.id,
    generated_at: new Date(q.created_at).toLocaleString(),
    title: q.details.title,
    difficulty: q.details.difficulty,
    result: 'Practice',
    time_taken: null,
    details: { ...q.details, company: q.company }
  })));
  if (pathname.startsWith('/api/history/') && method === 'DELETE') { const qid=Number(pathname.split('/').pop()); db.questions=db.questions.filter(q=>q.id!==qid); db.bookmarks=db.bookmarks.filter(b=>b.question_id!==qid); save(); return json(res,{success:true, message:'History record deleted successfully.'}); }
  if (pathname === '/api/search/suggestions') { const q=(url.searchParams.get('q')||'').toLowerCase(); const suggestions=sampleTopics.concat(db.questions.map(x=>x.topic)).filter((v,i,a)=>v.toLowerCase().includes(q)&&a.indexOf(v)===i).slice(0,6); return json(res,{suggestions,recent:db.searches.slice(-4).reverse(),popular:['Arrays','Python Basics','SQL Joins']}); }
  if (pathname === '/api/ai-search' && method === 'POST') { const body=await readBody(req); const query=body.query||'programming'; db.searches.push(query); save(); return json(res,{answer:`## ${escapeHtml(query)}\n\nA solid way to approach **${escapeHtml(query)}** is to clarify the input, identify constraints, and test a small example first.\n\n- Start with the simplest correct solution.\n- Check edge cases early.\n- Measure complexity before optimizing.\n\n\`\`\`javascript\nfunction solve(input) {\n  // State the invariant, then implement it.\n  return input;\n}\n\`\`\``}); }
  if (pathname === '/api/chat') { if (method==='GET') return json(res,db.chats); if(method==='DELETE'){db.chats=[];save();return json(res,{success:true});} const body=await readBody(req); const message=String(body.message||''); db.chats.push({sender:'user',message,timestamp:'Just now'}); const reply=`Try breaking “${message.slice(0,100)}” into inputs, expected output, and one small example. I can help you reason through the algorithm or review a code snippet.`; db.chats.push({sender:'ai',message:reply,timestamp:'Just now'});save();return json(res,{reply,timestamp:'Just now'}); }
  if (pathname === '/api/exam/submit' && method==='POST') { const body=await readBody(req); const answers=body.answers||{}; const qs=Object.keys(answers).map(k=>db.questions.find(q=>q.id===Number(k))).filter(Boolean); const correct=qs.filter(q=>answers[q.id]===q.details.answer).length; const score=qs.length?Math.round(correct/qs.length*100):0; const result={id:id(),title:body.title||'Assessment',questions:qs,answers,correct,score,time_taken:body.time_taken||0,created_at:new Date().toISOString()}; db.exams.push(result);save();return json(res,{result_id:result.id}); }
  if (pathname.startsWith('/api/exam/result/')) { const result=db.exams.find(x=>x.id===Number(pathname.split('/').pop())); return result ? json(res,examResultView(result)) : json(res,{error:'Result not found'},404); }
  if (pathname.startsWith('/api/export-exam-pdf/')) { const result=db.exams.find(x=>x.id===Number(pathname.split('/').pop())); return result ? text(res, `${result.title}\nScore: ${result.score}%\nCorrect: ${result.correct}/${result.questions.length}\nTime taken: ${result.time_taken}s`, 'text/plain; charset=utf-8') : json(res,{error:'Result not found'},404); }
  if (pathname.startsWith('/api/export-pdf/')) { const q=db.questions.find(x=>x.id===Number(pathname.split('/').pop())); return q ? text(res, `${q.details.title}\n\n${q.details.question}\n\nAnswer: ${q.details.answer}\n\n${q.details.explanation}`, 'text/plain; charset=utf-8') : json(res,{error:'Question not found'},404); }
  if (pathname === '/api/admin/stats') {
    const logs = (db.aiLogs || []).map(l => ({ username: 'Demo Learner', description: `Generated ${l.count || 1} ${l.type || 'mcq'} questions`, timestamp: new Date(l.created_at || Date.now()).toLocaleString() }));
    return json(res, { users_count: db.users.length || 1, questions_count: db.questions.length, exams_count: db.exams.length, users: db.users.length || 1, questions: db.questions.length, exams: db.exams.length, logs });
  }
  if (pathname === '/api/admin/users') return json(res, db.users.length ? db.users.map(u => ({ id: u.id, username: u.username, email: u.email, is_admin: false, created_at: new Date(u.created_at).toLocaleDateString() })) : [{id:1,username:'Demo Learner',email:'demo@qgen.ai',is_admin:true,created_at:'Today'}]);
  if (pathname === '/api/admin/questions') return json(res, db.questions.slice().reverse().map(q => ({ ...q, title: q.details ? q.details.title : 'Question', difficulty: q.details ? q.details.difficulty : 'Medium' })));
  if (pathname.startsWith('/api/admin/questions/') && method === 'DELETE') { const qid=Number(pathname.split('/').pop()); db.questions=db.questions.filter(q=>q.id!==qid); db.bookmarks=db.bookmarks.filter(b=>b.question_id!==qid); save(); return json(res,{success:true, message:'Question deleted successfully.'}); }
  if (pathname.startsWith('/api/admin/users/') && method === 'DELETE') return json(res,{success:true, message:'Demo user cannot be deleted.'});
  if (pathname === '/api/admin/db-clear' && method === 'POST') { db={nextId:1,questions:[],bookmarks:[],exams:[],chats:[],searches:[],users:[]}; save(); return json(res,{success:true, message:'Database reset successfully.'}); }
  return json(res,{error:'API endpoint not found'},404);
}

function serveFile(res, file) { const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'}; fs.readFile(file,(err,data)=>err ? text(res,'Not found','text/plain; charset=utf-8',404) : (res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}),res.end(data))); }
const server=http.createServer(async (req,res)=>{ try { const url=new URL(req.url,`http://${req.headers.host}`); if(url.pathname.startsWith('/api/')) return await api(req,res,url); let pathname=decodeURIComponent(url.pathname); const legacyPage=pathname.match(/^\/([a-z_]+)\.html$/); if(pathname==='/' ) pathname='/index.html'; else if(pageRoutes.has(pathname.slice(1))) pathname=`/pages/${pathname.slice(1)}.html`; else if(legacyPage && pageRoutes.has(legacyPage[1])) pathname=`/pages/${legacyPage[1]}.html`; const safe=path.normalize(path.join(ROOT,pathname)); if(!safe.startsWith(ROOT)) return text(res,'Forbidden','text/plain',403); serveFile(res,safe); } catch(e) { console.error(e); json(res,{error:'Server error'},500); } });
const port=Number(process.env.PORT)||5000; server.listen(port,()=>console.log(`QGen-AI running at http://localhost:${port}`));
