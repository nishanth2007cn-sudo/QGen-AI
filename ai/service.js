const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initializeAI();
    this.questionCache = new Map();
    this.recentQuestions = [];
    this.maxCacheSize = 1000;
    this.maxRecentSize = 500;
  }

  initializeAI() {
    if (config.ai.geminiApiKey && config.ai.geminiApiKey !== 'your-gemini-api-key-here') {
      this.genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
      this.model = this.genAI.getGenerativeModel({ model: config.ai.model });
      logger.info('Gemini AI initialized successfully');
    } else {
      logger.warn('Gemini API key not configured, using fallback generator');
    }
  }

  generateQuestionHash(questionData) {
    const content = `${questionData.type}|${questionData.topic}|${questionData.subtopic || ''}|${questionData.difficulty}|${questionData.language || ''}|${questionData.question}`;
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  isDuplicate(question, existingQuestions, threshold = 0.85) {
    const hash = this.generateQuestionHash(question);
    if (this.questionCache.has(hash)) return true;
    
    for (const existing of existingQuestions) {
      const similarity = this.calculateSimilarity(
        question.question.toLowerCase(),
        existing.question.toLowerCase()
      );
      if (similarity >= threshold) return true;
    }
    return false;
  }

  addToCache(question) {
    const hash = this.generateQuestionHash(question);
    this.questionCache.set(hash, question);
    this.recentQuestions.push(question);
    
    if (this.questionCache.size > this.maxCacheSize) {
      const firstKey = this.questionCache.keys().next().value;
      this.questionCache.delete(firstKey);
    }
    if (this.recentQuestions.length > this.maxRecentSize) {
      this.recentQuestions.shift();
    }
  }

  buildPrompt(params) {
    const { type, topic, subtopic, difficulty, language, company, bloomTaxonomy, learningOutcome, count, previousQuestions, randomSeed } = params;
    
    const typeInstructions = {
      mcq: `Generate ${count} unique multiple choice questions. Each must have:
- A clear, specific question
- Exactly 4 options (A, B, C, D)
- One correct answer
- Detailed explanation
- Difficulty: ${difficulty}`,
      
      coding: `Generate ${count} unique coding/programming challenges. Each must have:
- Problem statement with clear requirements
- Input/Output format specification
- Constraints
- Sample input and output
- Hidden test cases (at least 3)
- Time and space complexity
- Complete solution in ${language || 'Python'}
- Tags/topics
- Difficulty: ${difficulty}`,
      
      debugging: `Generate ${count} unique debugging exercises. Each must have:
- Buggy code snippet in ${language || 'Python'}
- Clear description of the bug/error
- Expected vs actual behavior
- Corrected code
- Explanation of the fix
- Difficulty: ${difficulty}`,
      
      prediction: `Generate ${count} unique output prediction questions. Each must have:
- Code snippet in ${language || 'Python'}
- Multiple choice options for output (4 options)
- Correct output
- Step-by-step execution trace/explanation
- Difficulty: ${difficulty}`,
      
      theory: `Generate ${count} unique theoretical/conceptual questions. Each must have:
- Detailed conceptual question
- Comprehensive answer/explanation
- Key concepts covered
- Related topics
- Difficulty: ${difficulty}`,
      
      scenario: `Generate ${count} unique scenario-based questions. Each must have:
- Real-world programming scenario
- Problem to solve
- Multiple choice or coding solution
- Best practices explanation
- Trade-offs discussion
- Difficulty: ${difficulty}`
    };

    const bloomGuidance = {
      remember: 'Focus on recall of facts, definitions, basic concepts',
      understand: 'Focus on explaining ideas, interpreting, summarizing',
      apply: 'Focus on using procedures, implementing, executing',
      analyze: 'Focus on breaking down, organizing, attributing',
      evaluate: 'Focus on checking, critiquing, judging',
      create: 'Focus on generating, planning, producing'
    };

    const languageSpecific = {
      python: 'Use Python 3 syntax, type hints where appropriate',
      javascript: 'Use modern ES6+ JavaScript',
      java: 'Use Java 17+ syntax',
      cpp: 'Use C++17/20 standard',
      c: 'Use C11 standard',
      csharp: 'Use C# 12/.NET 8',
      go: 'Use Go 1.22+',
      rust: 'Use Rust 2021 edition',
      kotlin: 'Use Kotlin 1.9+',
      sql: 'Use standard SQL (PostgreSQL dialect preferred)'
    };

    let prompt = `You are an expert programming educator and question generator. Generate ${count} unique, high-quality ${type} questions.

TOPIC: ${topic}${subtopic ? ` (Subtopic: ${subtopic})` : ''}
DIFFICULTY: ${difficulty}
LANGUAGE: ${language || 'Any'}${company ? `\nTARGET COMPANY: ${company}` : ''}
BLOOM'S TAXONOMY: ${bloomTaxonomy || 'apply'} - ${bloomGuidance[bloomTaxonomy] || bloomGuidance.apply}
LEARNING OUTCOME: ${learningOutcome || 'Solve programming problems effectively'}
RANDOM SEED: ${randomSeed || Date.now()}

${typeInstructions[type] || typeInstructions.mcq}

${language && languageSpecific[language.toLowerCase()] ? `\nLANGUAGE GUIDANCE: ${languageSpecific[language.toLowerCase()]}` : ''}

CRITICAL REQUIREMENTS:
1. Questions MUST be unique - no duplicates or near-duplicates
2. Avoid generic/template questions - make them specific to the topic
3. Include practical, real-world context
4. Vary question patterns and approaches
5. Ensure correctness of all answers and code
6. Format as valid JSON only

${previousQuestions && previousQuestions.length > 0 ? `
PREVIOUS QUESTIONS TO AVOID DUPLICATES:
${previousQuestions.map((q, i) => `${i + 1}. ${q.question.substring(0, 200)}`).join('\n')}
` : ''}

OUTPUT FORMAT (JSON array):
[
  {
    "question": "Full question text",
    "type": "${type}",
    "topic": "${topic}",
    "subtopic": "${subtopic || ''}",
    "difficulty": "${difficulty}",
    "language": "${language || ''}",
    "bloomTaxonomy": "${bloomTaxonomy || 'apply'}",
    "learningOutcome": "${learningOutcome || ''}",
    "details": { /* type-specific details */ }
  }
]`;

    return prompt;
  }

  parseAIResponse(response, type) {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found in response');
      
      const questions = JSON.parse(jsonMatch[0]);
      return questions.map(q => this.validateAndEnhanceQuestion(q, type));
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      return [];
    }
  }

  validateAndEnhanceQuestion(question, type) {
    const base = {
      question: question.question || '',
      type: question.type || type,
      topic: question.topic || '',
      subtopic: question.subtopic || '',
      difficulty: question.difficulty || 'Medium',
      language: question.language || '',
      bloomTaxonomy: question.bloomTaxonomy || 'apply',
      learningOutcome: question.learningOutcome || '',
      details: question.details || {}
    };

    switch (type) {
      case 'mcq':
        base.details = {
          options: Array.isArray(question.details?.options) ? question.details.options.slice(0, 4) : [],
          correctAnswer: question.details?.correctAnswer || 'A',
          explanation: question.details?.explanation || '',
          hint: question.details?.hint || ''
        };
        break;
      case 'coding':
        base.details = {
          problemStatement: question.details?.problemStatement || question.question,
          constraints: question.details?.constraints || [],
          inputFormat: question.details?.inputFormat || '',
          outputFormat: question.details?.outputFormat || '',
          sampleInput: question.details?.sampleInput || '',
          sampleOutput: question.details?.sampleOutput || '',
          hiddenTestCases: Array.isArray(question.details?.hiddenTestCases) ? question.details.hiddenTestCases : [],
          solution: question.details?.solution || '',
          timeComplexity: question.details?.timeComplexity || 'O(n)',
          spaceComplexity: question.details?.spaceComplexity || 'O(1)',
          tags: Array.isArray(question.details?.tags) ? question.details.tags : []
        };
        break;
      case 'debugging':
        base.details = {
          buggyCode: question.details?.buggyCode || '',
          errorDescription: question.details?.errorDescription || '',
          expectedBehavior: question.details?.expectedBehavior || '',
          actualBehavior: question.details?.actualBehavior || '',
          correctedCode: question.details?.correctedCode || '',
          explanation: question.details?.explanation || '',
          concepts: Array.isArray(question.details?.concepts) ? question.details.concepts : []
        };
        break;
      case 'prediction':
        base.details = {
          codeSnippet: question.details?.codeSnippet || '',
          options: Array.isArray(question.details?.options) ? question.details.options.slice(0, 4) : [],
          correctOutput: question.details?.correctOutput || '',
          executionTrace: question.details?.executionTrace || '',
          explanation: question.details?.explanation || ''
        };
        break;
      case 'theory':
        base.details = {
          answer: question.details?.answer || '',
          keyConcepts: Array.isArray(question.details?.keyConcepts) ? question.details.keyConcepts : [],
          relatedTopics: Array.isArray(question.details?.relatedTopics) ? question.details.relatedTopics : [],
          difficulty: question.difficulty || 'Medium'
        };
        break;
      case 'scenario':
        base.details = {
          scenario: question.details?.scenario || question.question,
          problem: question.details?.problem || '',
          solution: question.details?.solution || '',
          bestPractices: question.details?.bestPractices || '',
          tradeoffs: question.details?.tradeoffs || '',
          difficulty: question.difficulty || 'Medium'
        };
        break;
    }

    return base;
  }

  async generateQuestions(params) {
    const startTime = Date.now();
    const { count = 1, ...rest } = params;
    const randomSeed = params.randomSeed || Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    let previousQuestions = [];
    if (rest.type && rest.topic) {
      const db = require('../database');
      previousQuestions = db.prepare(`
        SELECT question FROM questions 
        WHERE type = ? AND topic LIKE ? 
        ORDER BY created_at DESC LIMIT 50
      `).all(rest.type, `${rest.topic}%`).map(r => ({ question: r.question }));
    }

    const prompt = this.buildPrompt({ ...rest, count, previousQuestions, randomSeed });
    
    let questions = [];
    let aiSuccess = false;
    let tokensUsed = 0;
    let errorMessage = null;

    if (this.model) {
      try {
        const result = await this.model.generateContent(prompt);
        const response = result.response.text();
        tokensUsed = response.length / 4;
        questions = this.parseAIResponse(response, rest.type);
        aiSuccess = questions.length > 0;
        
        if (!aiSuccess) {
          errorMessage = 'AI returned empty or invalid response';
        }
      } catch (error) {
        logger.error('AI generation failed:', error);
        errorMessage = error.message;
      }
    }

    if (!aiSuccess || questions.length < count) {
      questions = [...questions, ...this.generateFallbackQuestions({ ...rest, count: count - questions.length })];
    }

    const uniqueQuestions = [];
    for (const q of questions) {
      if (!this.isDuplicate(q, [...this.recentQuestions, ...uniqueQuestions])) {
        this.addToCache(q);
        uniqueQuestions.push(q);
        if (uniqueQuestions.length >= count) break;
      }
    }

    while (uniqueQuestions.length < count) {
      const fallback = this.generateFallbackQuestions({ ...rest, count: 1 })[0];
      if (!this.isDuplicate(fallback, [...this.recentQuestions, ...uniqueQuestions])) {
        this.addToCache(fallback);
        uniqueQuestions.push(fallback);
      }
    }

    const duration = Date.now() - startTime;
    
    if (params.userId) {
      const db = require('../database');
      db.prepare(`
        INSERT INTO ai_logs (user_id, prompt, response, model, tokens_used, duration_ms, success, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        params.userId,
        prompt.substring(0, 1000),
        JSON.stringify(uniqueQuestions).substring(0, 5000),
        config.ai.model,
        tokensUsed,
        duration,
        aiSuccess ? 1 : 0,
        errorMessage
      );
    }

    logger.info(`Generated ${uniqueQuestions.length} questions in ${duration}ms (AI: ${aiSuccess})`);
    return uniqueQuestions;
  }

  generateFallbackQuestions(params) {
    const { type, topic, subtopic, difficulty, language, count = 1 } = params;
    const templates = this.getFallbackTemplates(type, language);
    const questions = [];
    
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      const question = {
        ...template,
        question: template.question.replace('{topic}', topic).replace('{subtopic}', subtopic || topic),
        topic,
        subtopic: subtopic || '',
        difficulty,
        language: language || '',
        type,
        bloomTaxonomy: 'apply',
        learningOutcome: `Master ${topic} concepts`
      };
      questions.push(question);
    }
    return questions;
  }

  getFallbackTemplates(type, language) {
    const lang = (language || 'Python').toLowerCase();
    const codeTemplates = {
      python: 'def solve(input_data):\n    # TODO: Implement solution\n    pass',
      javascript: 'function solve(inputData) {\n  // TODO: Implement solution\n}',
      java: 'public class Solution {\n    public static void solve(String input) {\n        // TODO: Implement solution\n    }\n}',
      cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nvoid solve() {\n    // TODO: Implement solution\n}',
      c: '#include <stdio.h>\n\nvoid solve() {\n    // TODO: Implement solution\n}',
      csharp: 'using System;\n\npublic class Solution {\n    public void Solve() {\n        // TODO: Implement solution\n    }\n}',
      go: 'package main\n\nfunc solve() {\n    // TODO: Implement solution\n}',
      rust: 'fn solve() {\n    // TODO: Implement solution\n}',
      kotlin: 'fun solve() {\n    // TODO: Implement solution\n}',
      sql: 'SELECT * FROM table WHERE condition;'
    };

    const codeTemplate = codeTemplates[lang] || codeTemplates.python;

    return {
      mcq: [
        {
          question: 'What is the time complexity of the optimal algorithm for {topic}?',
          details: {
            options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
            correctAnswer: 'C',
            explanation: 'The optimal approach requires linear time to process all elements.',
            hint: 'Consider how many elements you need to examine.'
          }
        },
        {
          question: 'Which data structure is most suitable for implementing {topic}?',
          details: {
            options: ['Array', 'Hash Map', 'Stack', 'Queue'],
            correctAnswer: 'B',
            explanation: 'Hash maps provide O(1) average lookup time.',
            hint: 'Think about lookup requirements.'
          }
        },
        {
          question: 'What is the key invariant to maintain when solving {topic} problems?',
          details: {
            options: ['Sort the input first', 'Track the maximum element', 'Maintain a sliding window', 'Use two pointers'],
            correctAnswer: 'C',
            explanation: 'The sliding window technique efficiently tracks the required subarray.',
            hint: 'Consider how the window expands and contracts.'
          }
        }
      ],
      coding: [
        {
          question: 'Implement a function to solve the {topic} problem. Given an input, return the expected output following the constraints.',
          details: {
            problemStatement: 'Write a function that solves the {topic} problem efficiently.',
            constraints: ['1 ≤ n ≤ 10^5', 'Time limit: 1s', 'Space limit: 256MB'],
            inputFormat: 'First line: n. Second line: n space-separated integers.',
            outputFormat: 'Single integer: the result.',
            sampleInput: '5\n1 2 3 4 5',
            sampleOutput: '15',
            hiddenTestCases: [
              { input: '3\n10 20 30', output: '60' },
              { input: '1\n100', output: '100' },
              { input: '4\n-1 -2 -3 -4', output: '-10' }
            ],
            solution: codeTemplate,
            timeComplexity: 'O(n)',
            spaceComplexity: 'O(1)',
            tags: [topic.toLowerCase(), 'algorithm']
          }
        }
      ],
      debugging: [
        {
          question: 'Fix the bug in the following {topic} implementation.',
          details: {
            buggyCode: codeTemplate.replace('TODO: Implement solution', 'return input[0] // BUG: Only returns first element'),
            errorDescription: 'The function only returns the first element instead of the correct result.',
            expectedBehavior: 'Should process all elements and return the correct aggregate.',
            actualBehavior: 'Returns only the first element.',
            correctedCode: codeTemplate,
            explanation: 'The bug was returning early without processing all input elements.',
            concepts: ['iteration', 'accumulation', 'edge cases']
          }
        }
      ],
      prediction: [
        {
          question: 'What will be the output of the following code?',
          details: {
            codeSnippet: `def process(items):\n    result = 0\n    for item in items:\n        result += item\n    return result\n\nprint(process([1, 2, 3, 4]))`,
            options: ['10', '4', '1', 'Error'],
            correctOutput: '10',
            executionTrace: 'Iteration 1: result=1, Iteration 2: result=3, Iteration 3: result=6, Iteration 4: result=10',
            explanation: 'The function sums all elements in the list.'
          }
        }
      ],
      theory: [
        {
          question: 'Explain the fundamental concept behind {topic} and its applications.',
          details: {
            answer: '{topic} is a fundamental concept in computer science that involves...',
            keyConcepts: ['Concept 1', 'Concept 2', 'Concept 3'],
            relatedTopics: ['Related 1', 'Related 2'],
            difficulty: 'Medium'
          }
        }
      ],
      scenario: [
        {
          question: 'You are building a system that needs to handle {topic}. Design an approach.',
          details: {
            scenario: 'A real-world application requires efficient {topic} processing.',
            problem: 'Design a solution that handles the constraints.',
            solution: 'Use appropriate data structures and algorithms.',
            bestPractices: 'Consider time/space tradeoffs, edge cases, and scalability.',
            tradeoffs: 'Time vs space, simplicity vs performance.',
            difficulty: 'Medium'
          }
        }
      ]
    };

    return codeTemplates[type] || codeTemplates.mcq;
  }
}

module.exports = new AIService();