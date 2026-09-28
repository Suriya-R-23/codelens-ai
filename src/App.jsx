import { useState } from 'react';
import { SandpackProvider, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import ChatPanel from './ChatPanel';
import './App.css';

const initialFiles = {
  '/App.js': `export default function App() {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Hello from CodeLens AI</h1>
      <button style={{
        background: '#2563eb',
        color: 'white',
        padding: '10px 20px',
        border: 'none',
        borderRadius: 6,
        fontSize: 16
      }}>
        Login
      </button>
    </div>
  );
}`,
};

// Tells Monaco which syntax highlighting to use, based on the file extension.
const LANGUAGES = {
  js: 'javascript',
  jsx: 'javascript',
  css: 'css',
  html: 'html',
  json: 'json',
};

function getLanguage(filePath) {
  const extension = filePath.split('.').pop();
  return LANGUAGES[extension] ?? 'plaintext';
}

function Layout() {
  const { sandpack } = useSandpack();
  const { files, activeFile, setActiveFile, updateFile } = sandpack;

  // An AI change waiting for the user to keep or reject it, e.g.
  // { '/App.js': { before: '...old code...', after: '...new code...' } }
  const [review, setReview] = useState(null);
  // AI changes the user kept, oldest first, so they can be undone later.
  const [history, setHistory] = useState([]);

  // The AI's edits are already applied, so the preview shows the "after".
  // Here we remember the "before" so the change can be rejected.
  function startReview(changes) {
    setReview(changes);
    setActiveFile(Object.keys(changes)[0]);
  }

  function keepChange() {
    setHistory((prev) => [...prev, review]);
    setReview(null);
  }

  function undoLastChange() {
    const last = history[history.length - 1];
    const editedSince = Object.entries(last).some(([path, { after }]) => files[path]?.code !== after);
    if (editedSince && !window.confirm('You edited this code after the AI change. Undo anyway?')) {
      return;
    }
    for (const [path, { before }] of Object.entries(last)) {
      updateFile(path, before);
    }
    setHistory((prev) => prev.slice(0, -1));
  }

  function rejectChange() {
    for (const [path, { before }] of Object.entries(review)) {
      updateFile(path, before);
    }
    setReview(null);
  }

  // While reviewing, show the diff of the open file (or the first changed file).
  const reviewFile = review && (review[activeFile] ? activeFile : Object.keys(review)[0]);

  return (
    <div className="app-shell">
      <div className="top-row">
        <div className="left-pane">
          <div className="file-explorer">
            {Object.keys(files).map((filePath) => (
              <div
                key={filePath}
                className={`file-item ${filePath === activeFile ? 'active' : ''}`}
                onClick={() => setActiveFile(filePath)}
              >
                {filePath}
              </div>
            ))}
            <button
              className="undo-button"
              onClick={undoLastChange}
              disabled={history.length === 0 || review !== null}
              title="Undo the last AI change you kept"
            >
              ↶ Undo AI change
            </button>
          </div>
          {review && (
            <div className="review-bar">
              <span>Review the AI change: red = removed, green = added</span>
              <button className="review-keep" onClick={keepChange}>Keep</button>
              <button className="review-reject" onClick={rejectChange}>Reject</button>
            </div>
          )}
          <div className="editor-wrapper">
            {review ? (
              <DiffEditor
                height="100%"
                language={getLanguage(reviewFile)}
                theme="vs-dark"
                original={review[reviewFile].before}
                modified={review[reviewFile].after}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 14 }}
              />
            ) : (
              <Editor
                height="100%"
                language={getLanguage(activeFile)}
                theme="vs-dark"
                value={files[activeFile].code}
                onChange={(value) => updateFile(activeFile, value ?? '')}
                options={{ minimap: { enabled: false }, fontSize: 14 }}
              />
            )}
          </div>
        </div>
        <div className="right-pane">
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={true}
            style={{ height: '100%' }}
          />
        </div>
      </div>
      <div className="bottom-row">
        <ChatPanel reviewing={review !== null} onChange={startReview} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SandpackProvider template="react" files={initialFiles} theme="dark">
      <Layout />
    </SandpackProvider>
  );
}