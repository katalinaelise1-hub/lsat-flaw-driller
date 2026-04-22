# LSAT Flaw Driller

An AI-powered LSAT flaw question driller built with React + Vite, using Anthropic's Claude API via a secure Vercel serverless function.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the env example and add your API key:
   ```bash
   cp .env.example .env.local
   # Then edit .env.local and add your Anthropic API key
   ```

3. Run locally (requires Vercel CLI for the API route):
   ```bash
   npm install -g vercel
   vercel dev
   ```

## Deploy to Vercel

See the walkthrough in the project docs, or:

1. Push this folder to a GitHub repo
2. Import the repo at vercel.com
3. Add `ANTHROPIC_API_KEY` as an environment variable in Vercel's dashboard
4. Deploy

## Project Structure

```
lsat-flaw-driller/
├── api/
│   └── claude.js        # Serverless function — keeps API key secret
├── src/
│   ├── main.jsx         # React entry point
│   └── App.jsx          # Main application
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```
