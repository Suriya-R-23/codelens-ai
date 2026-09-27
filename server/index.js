// Small backend for CodeLens AI.
// The browser sends { request, files } here, we ask Claude for the smallest
// edit, and send back a list of find/replace edits. The API key lives only on
// this server, never in the browser.
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Reads ANTHROPIC_API_KEY from the environment (see .env.example).
const client = new Anthropic();

const SYSTEM_PROMPT = `You are the code-editing engine inside CodeLens AI, a visual web editor.
The user describes a change in plain English. You get the current project files.
Make the smallest possible code change that does what they asked.

Return edits as find/replace pairs:
- "file" is the file path exactly as given (e.g. "/App.js").
- "find" must be copied exactly from the current file, including spaces and
  indentation, and must appear exactly once in that file. Keep it short, but
  long enough to be unique.
- "replace" is the new text that takes its place.
Do not rewrite whole files. Do not change anything the user did not ask for.
If the request cannot be done, return an empty "edits" list and say why in "explanation".`;

// The JSON shape Claude must answer with (structured outputs).
const EDIT_SCHEMA = {
  type: 'object',
  properties: {
    explanation: { type: 'string' },
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
  required: ['explanation', 'edits'],
  additionalProperties: false,
};

app.post('/api/edit', async (req, res) => {
  const { request, files } = req.body ?? {};
  if (!request || !files) {
    return res.status(400).json({ error: 'Send { request, files }.' });
  }

  // Put each file in the prompt with its path so Claude knows what exists.
  const filesText = Object.entries(files)
    .map(([path, code]) => `<file path="${path}">\n${code}\n</file>`)
    .join('\n\n');

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      // If Claude declines a request, retry it on a recommended backup model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low', // small edits don't need deep thinking; keeps it fast
        format: { type: 'json_schema', schema: EDIT_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Current files:\n\n${filesText}\n\nRequest: ${request}`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'The AI declined this request.' });
    }

    const textBlock = response.content.find((block) => block.type === 'text');
    const result = JSON.parse(textBlock.text);
    res.json(result);
  } catch (error) {
    console.error(error);
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: 'Invalid or missing ANTHROPIC_API_KEY.' });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Rate limited, try again in a moment.' });
    }
    res.status(500).json({ error: 'Something went wrong talking to the AI.' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`CodeLens AI server running on http://localhost:${PORT}`);
});
