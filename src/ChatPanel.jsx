import { useState } from 'react';
import { useSandpack } from '@codesandbox/sandpack-react';

// Applies the AI's find/replace edits to a copy of the files.
// If any edit can't be matched exactly once, nothing is applied.
function applyEdits(files, edits) {
  const updated = {};
  for (const { file, find, replace } of edits) {
    const code = updated[file] ?? files[file]?.code;
    if (code === undefined) {
      throw new Error(`File not found: ${file}`);
    }
    const count = code.split(find).length - 1;
    if (count !== 1) {
      throw new Error(`Couldn't find a unique match in ${file} (found ${count}).`);
    }
    updated[file] = code.replace(find, () => replace);
  }
  return updated;
}

export default function ChatPanel() {
  const { sandpack } = useSandpack();
  const { files, updateFile } = sandpack;

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  function addMessage(role, text) {
    setMessages((prev) => [...prev, { role, text }]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const request = input.trim();
    if (!request || loading) return;

    addMessage('user', request);
    setInput('');
    setLoading(true);

    try {
      // Send only the code for each file (Sandpack stores extra info too).
      const currentCode = {};
      for (const [path, file] of Object.entries(files)) {
        currentCode[path] = file.code;
      }

      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, files: currentCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const updated = applyEdits(files, data.edits);
      for (const [path, code] of Object.entries(updated)) {
        updateFile(path, code);
      }
      addMessage('ai', data.explanation);
    } catch (error) {
      addMessage('error', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">Try: "make the button red"</div>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`chat-message ${message.role}`}>
            {message.text}
          </div>
        ))}
        {loading && <div className="chat-message ai">Thinking…</div>}
      </div>
      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          className="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Describe a change…"
          disabled={loading}
        />
        <button className="chat-send" type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
