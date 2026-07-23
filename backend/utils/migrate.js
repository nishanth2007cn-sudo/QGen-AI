const fs = require('fs');
const path = require('path');
const { pool, testConnection } = require('../config/database');
const config = require('../config');

async function runMigration() {
  console.log('Starting database migration...');
  
  const connected = await testConnection();
  if (!connected) {
    console.error('Failed to connect to database. Please check your .env configuration.');
    process.exit(1);
  }

  // Read schema file
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Split by semicolon and execute each statement
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      await pool.execute(statement);
      console.log('✓ Executed:', statement.substring(0, 60) + '...');
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_FIELDNAME') {
        console.log('⊘ Skipped (already exists):', statement.substring(0, 60) + '...');
      } else {
        console.error('✗ Error executing:', statement.substring(0, 100));
        console.error('  Error:', error.message);
      }
    }
  }

  // Insert default data
  await insertDefaultData();
  
  console.log('\nMigration completed successfully!');
  process.exit(0);
}

async function insertDefaultData() {
  console.log('\nInserting default data...');
  
  // Insert programming languages
  const languages = [
    { name: 'python', display_name: 'Python', icon_class: 'fa-brands fa-python', color: '#3776AB', sort_order: 1 },
    { name: 'javascript', display_name: 'JavaScript', icon_class: 'fa-brands fa-js', color: '#F7DF1E', sort_order: 2 },
    { name: 'java', display_name: 'Java', icon_class: 'fa-brands fa-java', color: '#007396', sort_order: 3 },
    { name: 'cpp', display_name: 'C++', icon_class: 'fa-brands fa-cuttlefish', color: '#00599C', sort_order: 4 },
    { name: 'c', display_name: 'C', icon_class: 'fa-solid fa-c', color: '#A8B9CC', sort_order: 5 },
    { name: 'csharp', display_name: 'C#', icon_class: 'fa-brands fa-microsoft', color: '#239120', sort_order: 6 },
    { name: 'go', display_name: 'Go', icon_class: 'fa-brands fa-golang', color: '#00ADD8', sort_order: 7 },
    { name: 'rust', display_name: 'Rust', icon_class: 'fa-brands fa-rust', color: '#DEA584', sort_order: 8 },
    { name: 'kotlin', display_name: 'Kotlin', icon_class: 'fa-brands fa-kotlin', color: '#7F52FF', sort_order: 9 },
    { name: 'sql', display_name: 'SQL', icon_class: 'fa-solid fa-database', color: '#336791', sort_order: 10 },
  ];

  for (const lang of languages) {
    try {
      await pool.execute(
        'INSERT IGNORE INTO programming_languages (name, display_name, icon_class, color, sort_order) VALUES (?, ?, ?, ?, ?)',
        [lang.name, lang.display_name, lang.icon_class, lang.color, lang.sort_order]
      );
      console.log(`✓ Language: ${lang.display_name}`);
    } catch (error) {
      console.error(`✗ Error inserting ${lang.name}:`, error.message);
    }
  }

  // Insert default topics for each language
  const topics = {
    python: [
      { name: 'Basics', slug: 'basics', subtopics: ['Variables', 'Data Types', 'Operators', 'Control Flow', 'Functions', 'Modules'] },
      { name: 'Data Structures', slug: 'data-structures', subtopics: ['Lists', 'Tuples', 'Dictionaries', 'Sets', 'Arrays', 'Strings'] },
      { name: 'OOP', slug: 'oop', subtopics: ['Classes', 'Inheritance', 'Polymorphism', 'Encapsulation', 'Magic Methods'] },
      { name: 'Advanced', slug: 'advanced', subtopics: ['Decorators', 'Generators', 'Context Managers', 'AsyncIO', 'Type Hints'] },
      { name: 'Algorithms', slug: 'algorithms', subtopics: ['Sorting', 'Searching', 'Dynamic Programming', 'Graph Algorithms', 'Greedy'] },
    ],
    javascript: [
      { name: 'Basics', slug: 'basics', subtopics: ['Variables', 'Data Types', 'Operators', 'Control Flow', 'Functions', 'Scope'] },
      { name: 'DOM Manipulation', slug: 'dom', subtopics: ['Selecting Elements', 'Event Handling', 'Creating Elements', 'Forms'] },
      { name: 'ES6+', slug: 'es6', subtopics: ['Arrow Functions', 'Destructuring', 'Modules', 'Promises', 'Async/Await'] },
      { name: 'Advanced', slug: 'advanced', subtopics: ['Closures', 'Prototypes', 'Event Loop', 'Web Workers', 'Service Workers'] },
      { name: 'Frameworks', slug: 'frameworks', subtopics: ['React', 'Vue', 'Angular', 'Node.js', 'Express'] },
    ],
    java: [
      { name: 'Basics', slug: 'basics', subtopics: ['Syntax', 'Data Types', 'Control Flow', 'Methods', 'Arrays'] },
      { name: 'OOP', slug: 'oop', subtopics: ['Classes', 'Inheritance', 'Interfaces', 'Abstract Classes', 'Polymorphism'] },
      { name: 'Collections', slug: 'collections', subtopics: ['ArrayList', 'LinkedList', 'HashMap', 'HashSet', 'TreeMap'] },
      { name: 'Advanced', slug: 'advanced', subtopics: ['Generics', 'Streams', 'Multithreading', 'Exceptions', 'JDBC'] },
      { name: 'Spring', slug: 'spring', subtopics: ['Spring Boot', 'Dependency Injection', 'Spring Data', 'Spring Security'] },
    ],
    cpp: [
      { name: 'Basics', slug: 'basics', subtopics: ['Syntax', 'Data Types', 'Control Flow', 'Functions', 'Arrays', 'Pointers'] },
      { name: 'OOP', slug: 'oop', subtopics: ['Classes', 'Inheritance', 'Polymorphism', 'Templates', 'STL'] },
      { name: 'Memory Management', slug: 'memory', subtopics: ['Stack vs Heap', 'Smart Pointers', 'RAII', 'Move Semantics'] },
      { name: 'Advanced', slug: 'advanced', subtopics: ['Concurrency', 'Metaprogramming', 'Design Patterns', 'Boost'] },
    ],
    c: [
      { name: 'Basics', slug: 'basics', subtopics: ['Syntax', 'Data Types', 'Control Flow', 'Functions', 'Arrays', 'Pointers'] },
      { name: 'Memory', slug: 'memory', subtopics: ['malloc/free', 'Structs', 'File I/O', 'Preprocessor'] },
      { name: 'Advanced', slug: 'advanced', subtopics: ['Data Structures', 'Algorithms', 'System Calls', 'Concurrency'] },
    ],
    csharp: [
      { name: 'Basics', slug: 'basics', subtopics: ['Syntax', 'Data Types', 'Control Flow', 'Methods', 'Arrays'] },
      { name: 'OOP', slug: 'oop', subtopics: ['Classes', 'Inheritance', 'Interfaces', 'Properties', 'Events', 'Delegates'] },
      { name: '.NET', slug: 'dotnet', subtopics: ['Collections', 'LINQ', 'Async/Await', 'Entity Framework', 'ASP.NET Core'] },
    ],
    go: [
      { name: 'Basics', slug: 'basics', subtopics: ['Syntax', 'Variables', 'Control Flow', 'Functions', 'Structs'] },
      { name: 'Concurrency', slug: 'concurrency', subtopics: ['Goroutines', 'Channels', 'Select', 'Mutex', 'WaitGroup'] },
      { name: 'Advanced', slug: 'advanced', subtopics: ['Interfaces', 'Generics', 'Reflection', 'Testing', 'Modules'] },
    ],
    rust: [
      { name: 'Basics', slug: 'basics', subtopics: ['Syntax', 'Variables', 'Control Flow', 'Functions', 'Ownership'] },
      { name: 'Ownership', slug: 'ownership', subtopics: ['Borrowing', 'Lifetimes', 'References', 'Slices'] },
      { name: 'Advanced', slug: 'advanced', subtopics: ['Traits', 'Generics', 'Pattern Matching', 'Concurrency', 'Async'] },
    ],
    kotlin: [
      { name: 'Basics', slug: 'basics', subtopics: ['Syntax', 'Variables', 'Control Flow', 'Functions', 'Null Safety'] },
      { name: 'OOP', slug: 'oop', subtopics: ['Classes', 'Inheritance', 'Interfaces', 'Data Classes', 'Sealed Classes'] },
      { name: 'Advanced', slug: 'advanced', subtopics: ['Coroutines', 'Flow', 'Extension Functions', 'DSL', 'Android'] },
    ],
    sql: [
      { name: 'Basics', slug: 'basics', subtopics: ['SELECT', 'WHERE', 'ORDER BY', 'LIMIT', 'DISTINCT'] },
      { name: 'Joins', slug: 'joins', subtopics: ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'SELF JOIN'] },
      { name: 'Aggregation', slug: 'aggregation', subtopics: ['GROUP BY', 'HAVING', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN'] },
      { name: 'Advanced', slug: 'advanced', subtopics: ['Subqueries', 'CTEs', 'Window Functions', 'Indexes', 'Transactions'] },
    ],
  };

  // Get language IDs
  const [languageRows] = await pool.execute('SELECT id, name FROM programming_languages');
  const languageMap = {};
  for (const row of languageRows) {
    languageMap[row.name] = row.id;
  }

  for (const [langName, langTopics] of Object.entries(topics)) {
    const languageId = languageMap[langName];
    if (!languageId) continue;

    for (const topic of langTopics) {
      try {
        const [result] = await pool.execute(
          'INSERT IGNORE INTO topics (language_id, name, slug, description, sort_order) VALUES (?, ?, ?, ?, ?)',
          [languageId, topic.name, topic.slug, `${topic.name} in ${langName}`, 0]
        );
        
        if (result.insertId > 0) {
          const topicId = result.insertId;
          console.log(`✓ Topic: ${langName} - ${topic.name}`);
          
          // Insert subtopics
          for (let i = 0; i < topic.subtopics.length; i++) {
            await pool.execute(
              'INSERT IGNORE INTO topics (language_id, name, slug, description, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
              [languageId, topic.subtopics[i], topic.subtopics[i].toLowerCase().replace(/\s+/g, '-'), `Subtopic: ${topic.subtopics[i]}`, topicId, i]
            );
          }
        }
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') {
          console.error(`✗ Error inserting topic ${topic.name}:`, error.message);
        }
      }
    }
  }

  console.log('\nDefault data inserted successfully!');
}

runMigration().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});