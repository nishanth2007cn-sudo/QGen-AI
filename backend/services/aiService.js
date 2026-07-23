const { hashQuestion, shuffleArray, randomInt, pickRandom, escapeHtml, similarityScore } = require('../utils/helpers');
const db = require('../config/db');

const QUESTION_TEMPLATES = {
  mcq: {
    topics: {
      'Arrays': ['two-pointer technique', 'sliding window', 'array reversal', 'prefix sum', 'kadane algorithm'],
      'Strings': ['palindrome checking', 'anagram detection', 'pattern matching', 'string compression', 'subsequence'],
      'Linked Lists': ['cycle detection', 'merge two lists', 'reverse in groups', 'middle element', 'intersection point'],
      'Trees': ['BST validation', 'level order traversal', 'LCA', 'diameter', 'max path sum'],
      'Sorting': ['merge sort', 'quick sort', 'counting sort', 'bubble sort', 'heap sort'],
      'Searching': ['binary search', 'ternary search', 'exponential search', 'interpolation search', 'jump search'],
      'Dynamic Programming': ['knapSack', 'LCS', 'LIS', 'edit distance', 'matrix chain'],
      'Graphs': ['BFS', 'DFS', 'dijkstra', 'topological sort', 'mst'],
      'Recursion': ['tower of hanoi', 'n-queens', 'subset sum', 'permutations', 'combinations'],
      'SQL': ['joins', 'normalization', 'indexes', 'subqueries', 'aggregation'],
      'OOP': ['inheritance', 'polymorphism', 'encapsulation', 'abstraction', 'interfaces'],
      'OS': ['process scheduling', 'memory management', 'file systems', 'deadlock', 'paging']
    }
  },
  coding: {
    topics: {
      'Arrays': ['Find max subarray sum', 'Rotate array by k', 'Merge overlapping intervals', 'Find missing number', 'Container with most water'],
      'Strings': ['Longest palindromic substring', 'String to integer', 'Valid parentheses', 'Group anagrams', 'Longest substring without repeating'],
      'Linked Lists': ['Reverse a linked list', 'Detect cycle', 'Merge sorted lists', 'Remove nth node', 'LRU cache'],
      'Trees': ['Inorder traversal', 'Max depth', 'Symmetric tree', 'Path sum', 'Serialize binary tree'],
      'Dynamic Programming': ['Coin change', 'Longest increasing subsequence', 'Edit distance', 'Unique paths', 'House robber'],
      'Graphs': ['Clone graph', 'Course schedule', 'Number of islands', 'Word ladder', 'Alien dictionary']
    }
  },
  debugging: {
    errors: ['NullPointerException', 'ArrayIndexOutOfBounds', 'StackOverflow', 'Infinite Loop', 'Off-by-one', 'TypeError', 'ReferenceError', 'SyntaxError']
  },
  prediction: {
    constructs: ['for loop', 'while loop', 'recursive function', 'map/filter/reduce', 'callback chain', 'promise chain', 'pointer arithmetic']
  },
  theory: {
    topics: {
      'OOP': ['encapsulation', 'polymorphism', 'inheritance', 'abstraction', 'SOLID principles'],
      'DBMS': ['ACID properties', 'normalization forms', 'indexing strategies', 'transaction isolation', 'CAP theorem'],
      'OS': ['scheduling algorithms', 'paging vs segmentation', 'deadlock conditions', 'virtual memory', 'thread vs process'],
      'Networking': ['TCP/IP model', 'OSI layers', 'HTTP vs HTTPS', 'DNS resolution', 'load balancing'],
      'DSA': ['time complexity', 'space complexity', 'divide and conquer', 'greedy vs dp', 'backtracking']
    }
  }
};

const DIFFICULTY_CONFIG = {
  Easy: { bloomLevel: 'Remember/Understand', complexity: 'O(n) or less', timeMin: 2, timeMax: 5, marks: 2 },
  Medium: { bloomLevel: 'Apply/Analyze', complexity: 'O(n log n) or O(n²)', timeMin: 5, timeMax: 12, marks: 5 },
  Hard: { bloomLevel: 'Evaluate/Create', complexity: 'O(n²) or exponential', timeMin: 10, timeMax: 25, marks: 10 }
};

const LANGUAGES = ['C', 'C++', 'Java', 'Python', 'JavaScript', 'C#', 'Go', 'Rust', 'Kotlin', 'SQL'];

function generateSeed(input) {
  const seedBase = `${input.lang || ''}-${input.topic || ''}-${input.subtopic || ''}-${input.difficulty || ''}-${input.type || ''}-${Date.now()}-${Math.random()}-${Math.random()}`;
  let hash = 0;
  for (const c of seedBase) hash = ((hash << 5) - hash) + c.charCodeAt(0) | 0;
  return Math.abs(hash);
}

function buildQuestion(input, seed, index, existingHashes) {
  const { type, topic, subtopic, difficulty, lang, company } = input;
  const qType = (type || 'mcq').toLowerCase();
  const qDifficulty = difficulty || 'Medium';
  const diff = DIFFICULTY_CONFIG[qDifficulty] || DIFFICULTY_CONFIG.Medium;
  const qLang = lang || pickRandom(LANGUAGES);
  const qTopic = topic || 'Programming fundamentals';

  let questionData = null;

  switch (qType) {
    case 'mcq':
      questionData = generateMCQ(qTopic, qLang, subtopic, diff, seed, index, existingHashes);
      break;
    case 'coding':
      questionData = generateCoding(qTopic, qLang, subtopic, diff, seed, index, existingHashes);
      break;
    case 'debugging':
      questionData = generateDebugging(qLang, diff, seed, index, existingHashes);
      break;
    case 'prediction':
      questionData = generatePrediction(qLang, diff, seed, index, existingHashes);
      break;
    case 'theory':
      questionData = generateTheory(qTopic, diff, seed, index, existingHashes);
      break;
    default:
      questionData = generateMCQ(qTopic, qLang, subtopic, diff, seed, index, existingHashes);
  }

  return questionData;
}

function generateMCQ(topic, lang, subtopic, diff, seed, index, existingHashes) {
  const templates = QUESTION_TEMPLATES.mcq.topics;
  const topicKeys = Object.keys(templates);
  const qTopic = topic || pickRandom(topicKeys);
  const subTopics = templates[qTopic] || templates[pickRandom(topicKeys)];
  const qSubtopic = subtopic || subTopics[(seed + index) % subTopics.length];

  const questions = [
    `Which of the following is the most efficient approach for implementing ${qSubtopic} in ${lang}?`,
    `What is the time complexity of the optimal ${qSubtopic} algorithm in ${lang}?`,
    `Which data structure is best suited for implementing ${qSubtopic}?`,
    `What will be the output of applying ${qSubtopic} to the input [3, 1, 4, 1, 5, 9]?`,
    `Which edge case must be handled when implementing ${qSubtopic} in ${lang}?`,
    `In ${lang}, what is the recommended way to handle ${qSubtopic}?`,
    `Which of the following correctly implements ${qSubtopic}?`,
    `What is the primary advantage of using ${qSubtopic}?`
  ];

  const question = questions[(seed + index) % questions.length];
  const opts = [
    `A) Implementing using a hash-based approach with O(1) average lookup`,
    `B) Using nested loops to ensure all combinations are checked`,
    `C) Applying memoization to cache intermediate results`,
    `D) Using a divide-and-conquer strategy to split the problem`
  ];
  const correctAnswer = 'A';
  const hints = [
    `Think about the space-time tradeoff involved in ${qSubtopic}.`,
    `Consider the worst-case and average-case scenarios.`,
    `Focus on the invariants that must hold during ${qSubtopic}.`
  ];

  const qText = `${question}\n\nOptions:\n${opts.join('\n')}`;
  const qHash = hashQuestion(qText);

  if (existingHashes.has(qHash)) return null;

  return {
    type: 'mcq',
    topic: qTopic,
    subtopic: qSubtopic,
    difficulty: diff.bloomLevel.split('/')[0],
    lang,
    bloomLevel: diff.bloomLevel,
    estimatedTime: randomInt(diff.timeMin, diff.timeMax),
    marks: diff.marks,
    seed,
    hash: qHash,
    details: {
      question: qText,
      title: `${diff.bloomLevel.split('/')[0]}: ${qSubtopic} in ${lang}`,
      options: opts,
      answer: 'A',
      explanation: `The optimal approach for ${qSubtopic} uses a technique that minimizes time complexity while maintaining correctness through careful invariant tracking. The hash-based approach provides O(1) average lookup, making it the most efficient choice.`,
      hint: hints[(seed + index) % hints.length],
      time_complexity: diff.complexity,
      space_complexity: 'O(1) or O(n) depending on implementation'
    }
  };
}

function generateCoding(topic, lang, subtopic, diff, seed, index, existingHashes) {
  const templates = QUESTION_TEMPLATES.coding.topics;
  const topicKeys = Object.keys(templates);
  const qTopic = topic || pickRandom(topicKeys);
  const problems = templates[qTopic] || templates[pickRandom(topicKeys)];
  const problem = subtopic || problems[(seed + index) % problems.length];

  const qText = `${problem}\n\nConstraints:\n- 1 ≤ input size ≤ 10^5\n- Time Limit: ${diff.complexity}\n- Expected Space: O(n) or better`;
  const qHash = hashQuestion(qText);

  if (existingHashes.has(qHash)) return null;

  return {
    type: 'coding',
    topic: qTopic,
    subtopic: problem,
    difficulty: diff.bloomLevel.split('/')[0],
    lang,
    bloomLevel: diff.bloomLevel,
    estimatedTime: randomInt(diff.timeMin, diff.timeMax),
    marks: diff.marks,
    seed,
    hash: qHash,
    details: {
      question: qText,
      title: `Coding: ${problem}`,
      constraints: '1 ≤ input size ≤ 10^5, -10^9 ≤ values ≤ 10^9',
      sampleInput: '5\n[2, 4, 1, 3, 5]',
      sampleOutput: '15',
      hiddenTestCases: [
        { input: '1\n[1]', output: '1' },
        { input: '3\n[-1, -2, -3]', output: '-1' },
        { input: '6\n[1, -2, 3, 4, -5, 6]', output: '14' }
      ],
      difficulty: diff.bloomLevel.split('/')[0],
      tags: [qTopic, lang, diff.bloomLevel.split('/')[0]],
      hint: `Think about the optimal approach for ${problem}. Can you do it in one pass?`,
      explanation: `The solution to ${problem} requires careful analysis of the problem constraints and choosing the right algorithmic paradigm.`,
      time_complexity: diff.complexity,
      space_complexity: 'O(1) or O(n)'
    }
  };
}

function generateDebugging(lang, diff, seed, index, existingHashes) {
  const errors = QUESTION_TEMPLATES.debugging.errors;
  const error = errors[(seed + index) % errors.length];

  const buggyCode = `// Buggy ${lang} code\nfunction processData(arr) {\n  let result = [];\n  for (let i = 0; i <= arr.length; i++) {\n    result.push(arr[i] * 2);\n  }\n  return result;\n}`;
  const qText = `Debug the following code. It contains a ${error}:\n\n${buggyCode}\n\nIdentify the error and provide the correct implementation.`;
  const qHash = hashQuestion(qText);

  if (existingHashes.has(qHash)) return null;

  return {
    type: 'debugging',
    topic: 'Debugging',
    subtopic: error,
    difficulty: diff.bloomLevel.split('/')[0],
    lang,
    bloomLevel: diff.bloomLevel,
    estimatedTime: randomInt(diff.timeMin, diff.timeMax),
    marks: diff.marks,
    seed,
    hash: qHash,
    details: {
      question: qText,
      title: `Debugging: Fix ${error}`,
      buggyCode,
      errorType: error,
      errorExplanation: `The code has an off-by-one error in the loop condition (i <= arr.length instead of i < arr.length), which causes ${error} when accessing arr[arr.length].`,
      correctSolution: `function processData(arr) {\n  let result = [];\n  for (let i = 0; i < arr.length; i++) {\n    result.push(arr[i] * 2);\n  }\n  return result;\n}`,
      hint: `Pay attention to the loop bounds. What happens when i equals arr.length?`,
      explanation: `Array indices range from 0 to length-1. Accessing index arr.length is out of bounds, causing ${error}.`
    }
  };
}

function generatePrediction(lang, diff, seed, index, existingHashes) {
  const constructs = QUESTION_TEMPLATES.prediction.constructs;
  const construct = constructs[(seed + index) % constructs.length];

  const codeSnippet = `// Predict the output of this ${construct} in ${lang}\nlet x = 5;\nfunction mystery(n) {\n  if (n <= 1) return n;\n  return mystery(n - 1) + mystery(n - 2);\n}\nconsole.log(mystery(x));`;
  const correctOutput = '5';
  const qText = `What will be the output of the following ${construct} in ${lang}?\n\n${codeSnippet}`;
  const qHash = hashQuestion(qText);

  if (existingHashes.has(qHash)) return null;

  return {
    type: 'prediction',
    topic: 'Output Prediction',
    subtopic: construct,
    difficulty: diff.bloomLevel.split('/')[0],
    lang,
    bloomLevel: diff.bloomLevel,
    estimatedTime: randomInt(diff.timeMin, diff.timeMax),
    marks: diff.marks,
    seed,
    hash: qHash,
    details: {
      question: qText,
      title: `Output Prediction: ${construct}`,
      codeSnippet,
      correctOutput,
      explanation: `The function mystery(n) computes the nth Fibonacci number. For n=5, the sequence is 0,1,1,2,3,5. So mystery(5) returns 5.`,
      hint: `Trace the recursive calls for small values of n and look for the pattern.`,
      solution: correctOutput
    }
  };
}

function generateTheory(topic, diff, seed, index, existingHashes) {
  const templates = QUESTION_TEMPLATES.theory.topics;
  const topicKeys = Object.keys(templates);
  const qTopic = topic || pickRandom(topicKeys);
  const concepts = templates[qTopic] || templates[pickRandom(topicKeys)];
  const concept = concepts[(seed + index) % concepts.length];

  const qText = `Explain the concept of ${concept} in ${qTopic}. Provide a detailed explanation with examples.`;
  const qHash = hashQuestion(qText);

  if (existingHashes.has(qHash)) return null;

  return {
    type: 'theory',
    topic: qTopic,
    subtopic: concept,
    difficulty: diff.bloomLevel.split('/')[0],
    lang: 'General',
    bloomLevel: diff.bloomLevel,
    estimatedTime: randomInt(diff.timeMin, diff.timeMax),
    marks: diff.marks,
    seed,
    hash: qHash,
    details: {
      question: qText,
      title: `Theory: ${concept} in ${qTopic}`,
      explanation: `${concept} is a fundamental concept in ${qTopic}. It involves understanding the core principles and being able to apply them in practical scenarios.`,
      hint: `Think about the key properties and use cases of ${concept}.`,
      solution: `A comprehensive answer would cover: definition, key characteristics, examples, advantages, disadvantages, and practical applications of ${concept} in ${qTopic}.`,
      time_complexity: 'N/A (conceptual)',
      space_complexity: 'N/A (conceptual)'
    }
  };
}

function generateQuestions(req, res) {
  const { type, topic, subtopic, difficulty, lang, count = 1, company } = req.body;
  const database = db.getDb();
  const requestedCount = Math.max(1, Math.min(Number(count) || 1, 50));

  const existingHashes = new Set(database.questions.map(q => q.hash).filter(Boolean));

  const results = [];
  let attempts = 0;
  const maxAttempts = requestedCount * 3;

  while (results.length < requestedCount && attempts < maxAttempts) {
    const questionData = buildQuestion({ type, topic, subtopic, difficulty, lang, company }, generateSeed({ lang, topic, subtopic, difficulty, type }) + attempts, results.length, existingHashes);
    if (questionData) {
      const id = db.nextId();
      const question = {
        id,
        type: questionData.type,
        topic: questionData.topic,
        subtopic: questionData.subtopic,
        difficulty: questionData.difficulty,
        lang: questionData.lang,
        bloomLevel: questionData.bloomLevel,
        estimatedTime: questionData.estimatedTime,
        marks: questionData.marks,
        seed: questionData.seed,
        hash: questionData.hash,
        details: questionData.details,
        company: company || '',
        createdAt: new Date().toISOString()
      };
      database.questions.push(question);
      existingHashes.add(questionData.hash);
      results.push(question);
    }
    attempts++;
  }

  db.save();
  res.json(results);
}

module.exports = { generateQuestions, buildQuestion, generateSeed };