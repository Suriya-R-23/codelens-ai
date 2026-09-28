import { useEffect, useRef, useState } from 'react';
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
  const messagesRef = useRef(null);

  // Keep the newest message in view.
  useEffect(() => {
    const box = messagesRef.current;
    box.scrollTop = box.scrollHeight;
  }, [messages, loading]);

  // The question the AI is waiting for an answer to, e.g.
  // { request: "make the background red", question: "Which background?" }
  const [pending, setPending] = useState(null);

  function addMessage(message) {
    setMessages((prev) => [...prev, message]);
  }

  // Sends a request to the AI, then either applies its edits or shows its question.
  async function askAI(request) {
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

      if (data.type === 'clarify') {
        addMessage({ role: 'ai', text: data.question, options: data.options });
        setPending({ request, question: data.question });
        return;
      }

      const updated = applyEdits(files, data.edits);
      for (const [path, code] of Object.entries(updated)) {
        updateFile(path, code);
      }
      addMessage({ role: 'ai', text: data.explanation });
    } catch (error) {
      addMessage({ role: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  // The user answered the AI's question: send the original request plus the answer.
  function answerQuestion(answer) {
    if (!pending || loading) return;
    addMessage({ role: 'user', text: answer });
    // Grey out the option buttons so they can't be clicked twice.
    setMessages((prev) => prev.map((message) => ({ ...message, answered: true })));
    setPending(null);
    askAI(`${pending.request}\n\nClarifying question: ${pending.question}\nUser's answer: ${answer}`);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const request = input.trim();
    if (!request || loading) return;

    setInput('');
    addMessage({ role: 'user', text: request });
    askAI(request);
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={messagesRef}>
        {messages.length === 0 && (
          <div className="chat-empty">Try: "make the button red"</div>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`chat-message ${message.role}`}>
            {message.text}
            {message.options && (
              <div className="chat-options">
                {message.options.map((option) => (
                  <button
                    key={option}
                    className="chat-option"
                    onClick={() => answerQuestion(option)}
                    disabled={message.answered || loading}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
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
