# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-07-22

### Added
- Expanded MCQ Exam setups with subtopic, company, count, and timer controls.
- Full Grade calculations and analytics (Topic/Difficulty/Company analysis) in result submissions.
- Added Marked.js and Highlight.js to support Markdown rendering and syntax highlighting in AI Search and floating Chatbot.
- Developed real-time, debounced search suggestions showing suggestions, recent searches, and popular topics.
- Multi-chart dashboard tracking practice streaks, difficulty distribution, topic solves, and company readiness.
- Inline question paper editing textareas and formatting in PDF/Print compiles.
- Delete individual generation logs from History page.
- Admin sub-tabs for User Management and Question repository control.
- Global Toast notification system.

### Fixed
- Fixed bulk generation limits by implementing `generate_questions` in `GeminiService`.
