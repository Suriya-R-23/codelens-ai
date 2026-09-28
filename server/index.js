// Small backend for CodeLens AI.
// The browser sends { request, files } here, we ask Gemini for the smallest
// edit, and send back a list of find/replace edits. The API key lives only on
// this server, never in the browser.
import express from 'express';
import { GoogleGenAI, ApiError } from '@google/genai';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Reads GEMINI_API_KEY from the environment (see .env.example).
// If Google's servers are busy (e.g. error 503), try up to 2 times per model.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { retryOptions: { attempts: 2 } },
});

const SYSTEM_PROMPT = `You are the code-editing engine inside CodeLens AI, a visual web editor.
The user describes a change in plain English. You get the current project files.

First decide if the request is clear enough to act on.

Ask a clarifying question (type "clarify") only when the request could reasonably
mean two or more different elements or changes, and picking the wrong one would
give a clearly different result. Example: "make the background red" when both the
page and a button have a background. Then:
- "question" is one short, friendly question.
- "options" are 2 to 4 short answers the user can click (e.g. "Page background").
- "edits" is empty.
If the request already includes the user's answer to an earlier question, do not
ask again. If there is one obvious reading, do not ask. Just make the edit.

Otherwise make the smallest possible code change (type "edit"), as find/replace pairs:
- "file" is the file path exactly as given (e.g. "/App.js").
- "find" must be copied exactly from the current file, including spaces and
  indentation, and must appear exactly once in that file. Keep it short, but
  long enough to be unique.
- "replace" is the new text that takes its place.
Do not rewrite whole files. Do not change anything the user did not ask for.
Set "question" to "" and "options" to [].

"explanation" always briefly says what you did or why you are asking.
If the request cannot be done, use type "edit" with an empty "edits" list and say why.`;

// Free-tier models to try, in order. If one is busy (503) or not available
// to this key (404), the next one is tried.
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];

// Asks each model in turn until one answers.
async function generateWithFallback(request) {
  let lastError;
  for (const model of MODELS) {
    try {
      return await ai.models.generateContent({ ...request, model });
    } catch (error) {
      const canTryNext = error instanceof ApiError && [503, 404].includes(error.status);
      if (!canTryNext) throw error;
      console.warn(`${model} failed with ${error.status}, trying the next model...`);
      lastError = error;
    }
  }
  throw lastError;
}

// The JSON shape Gemini must answer with: either an edit or a clarifying question.
const EDIT_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['edit', 'clarify'] },
    explanation: { type: 'string' },
    question: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    edits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          find: { type: 'string' },
          replace: { type: 'string' },
        },
        required: ['file', 'find', 'replace'],
        additionalProperties: false,
      },
    },
  },
  required: ['type', 'explanation', 'question', 'options', 'edits'],
  additionalProperties: false,
};

app.post('/api/edit', async (req, res) => {
  const { request, files } = req.body ?? {};
  if (!request || !files) {
    return res.status(400).json({ error: 'Send { request, files }.' });
  }

  // Put each file in the prompt with its path so the AI knows what exists.
  const filesText = Object.entries(files)
    .map(([path, code]) => `<file path="${path}">\n${code}\n</file>`)
    .join('\n\n');

  try {
    const response = await generateWithFallback({
      contents: `Current files:\n\n${filesText}\n\nRequest: ${request}`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: EDIT_SCHEMA,
      },
    });

    if (!response.text) {
      return res.status(422).json({ error: 'The AI returned no answer. Try rephrasing.' });
    }

    const result = JSON.parse(response.text);

    // A question with nothing to click isn't useful, so treat it as an edit reply.
    if (result.type === 'clarify' && result.options.length === 0) {
      result.type = 'edit';
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    if (error instanceof ApiError && error.status === 429) {
      return res.status(429).json({ error: 'Free-tier limit reached, wait a minute and try again.' });
    }
    if (error instanceof ApiError && error.status === 503) {
      return res.status(503).json({ error: 'Gemini is busy right now, try again in a few seconds.' });
    }
    if (error instanceof ApiError && error.status === 400) {
      return res.status(500).json({ error: 'Invalid or missing GEMINI_API_KEY.' });
    }
    res.status(500).json({ error: 'Something went wrong talking to the AI.' });
  }
});

const PORT = 3001;
app.listen(PORT, (error) => {
  if (error) {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Is the server already running in another terminal?`);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
  console.log(`CodeLens AI server running on http://localhost:${PORT}`);
});
