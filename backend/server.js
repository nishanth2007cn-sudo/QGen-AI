const express = require('express');
const path = require('path');
const fs = require('fs');

const app = require('./app');

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`QGen-AI running at http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});