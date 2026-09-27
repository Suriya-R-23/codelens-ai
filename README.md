# CodeLens AI

An AI-powered visual web editor: code editor on the left, live preview on the right, and an AI chat at the bottom that makes small, targeted code edits.

## Running locally

You need Node.js 20.6 or newer and an Anthropic API key.

1. Install packages: `npm install`
2. Copy `.env.example` to `.env` and put your API key in it
3. Start the backend: `npm run server` (runs on port 3001)
4. In a second terminal, start the frontend: `npm run dev`
5. Open the URL Vite prints, then type something like "make the button red" in the chat

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
