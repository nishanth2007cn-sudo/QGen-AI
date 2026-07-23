# QGen-AI

**QGen-AI** is a state-of-the-art AI-powered Programming Learning and Assessment Platform. It uses Gemini AI models to generate programming questions, dry runs, multiple solutions, and conduct customized timer-based MCQ examinations.

## Core Features

- **Interactive Question Generator**: Bulk generate coding, MCQ, debugging, and predict-output questions. Complete with algorithms, dry runs, complexity analysis, and multi-language solutions.
- **MCQ Exam Mode**: Simulated timer-based test sessions with a navigation palette, flags, and review later options.
- **Smart Analytics Dashboard**: Tracks daily/weekly practice streaks, average accuracy, strengths/weaknesses, company readiness, and displays progress using Chart.js visualizations.
- **Smart Search Suggestions**: Dynamic, debounced autocomplete search suggestions showing matching items, popular searches, and search history.
- **Floating AI Chatbot**: A global programming assistant widget capable of reviewing code, fixing bugs, and answering conceptual topics.

## Tech Stack

- **Frontend**: Pure HTML5, CSS3, ES6 JavaScript, Chart.js, Marked.js, Highlight.js
- **Backend**: Dependency-free Node.js server with JSON persistence (no API keys required for local demo mode)

## Setup & Execution

The project runs as a complete local application. The included Node.js server provides question generation, bookmarks, history, exams, analytics, search, and chat APIs. Generated data is saved locally in `data/qgen-data.json`.

### 1. Running Locally
With Node.js 18+ installed:
```bash
npm start
```
Then open `http://localhost:5000`.

### 2. Deployment
For production, deploy the Node server to a Node-compatible host. Static-only hosts will not run the interactive API routes.

**To deploy to Vercel via Git:**
1. Push your code to GitHub:
   ```bash
   git add -A
   git commit -m "Initial commit of static site"
   git push origin main
   ```
2. Go to your Vercel Dashboard, import the repository, and Vercel will instantly detect it and serve `index.html` at the root!
