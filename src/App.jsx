import { useEffect, useRef, useState } from 'react';
import { SandpackProvider, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import ChatPanel from './ChatPanel';
// The click-to-select helper that runs inside the preview, loaded as plain text.
import inspectorCode from './sandbox/codelens-inspector.js?raw';
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
  // Same as Sandpack's default entry file, plus one line that loads the helper.
  '/index.js': `import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./codelens-inspector"; // CodeLens: lets you click elements in the preview

import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);`,
  // Hidden from the file tabs and never sent to the AI.
  '/codelens-inspector.js': { code: inspectorCode, hidden: true },
};

// Sends a message to the click-to-select helper inside the preview.
function sendToPreview(message) {
  const iframe = document.querySelector('.right-pane iframe');
  iframe?.contentWindow?.postMessage({ source: 'codelens', ...message }, '*');
}

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
  // Changes that were undone, newest last, so they can be redone.
  const [redoStack, setRedoStack] = useState([]);

  // The AI's edits are already applied, so the preview shows the "after".
  // Here we remember the "before" so the change can be rejected.
  function startReview(changes) {
    setReview(changes);
    setActiveFile(Object.keys(changes)[0]);
  }

  function keepChange() {
    setHistory((prev) => [...prev, review]);
    setRedoStack([]); // a new change replaces anything that was undone
    setReview(null);
  }

  // Checks the files still look the way the change expects; if the user edited
  // them by hand since, asks before overwriting their edits.
  function okToOverwrite(change, expected, action) {
    const editedSince = Object.entries(change).some(
      ([path, versions]) => files[path]?.code !== versions[expected],
    );
    return !editedSince || window.confirm(`You edited this code by hand since. ${action} anyway?`);
  }

  function undoLastChange() {
    const last = history[history.length - 1];
    if (!okToOverwrite(last, 'after', 'Undo')) return;
    for (const [path, { before }] of Object.entries(last)) {
      updateFile(path, before);
    }
    setHistory((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
  }

  function redoLastChange() {
    const last = redoStack[redoStack.length - 1];
    if (!okToOverwrite(last, 'before', 'Redo')) return;
    for (const [path, { after }] of Object.entries(last)) {
      updateFile(path, after);
    }
    setRedoStack((prev) => prev.slice(0, -1));
    setHistory((prev) => [...prev, last]);
  }

  function rejectChange() {
    for (const [path, { before }] of Object.entries(review)) {
      updateFile(path, before);
    }
    setReview(null);
  }

  // Click-to-select: whether select mode is on, and the element the user picked.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(null);
  const selectingRef = useRef(false); // same value, readable inside the message listener

  // Tell the preview when select mode turns on or off.
  useEffect(() => {
    selectingRef.current = selecting;
    sendToPreview({ type: 'select-mode', on: selecting });
  }, [selecting]);

  // Listen for messages from the helper inside the preview.
  useEffect(() => {
    function handleMessage(event) {
      const iframe = document.querySelector('.right-pane iframe');
      const message = event.data;
      if (event.source !== iframe?.contentWindow || message?.source !== 'codelens') return;

      if (message.type === 'selected') {
        setSelected(message.element);
        setSelecting(false);
      }
      if (message.type === 'cancelled') {
        setSelecting(false);
      }
      // The preview (re)loaded: tell it the current mode.
      if (message.type === 'ready') {
        sendToPreview({ type: 'select-mode', on: selectingRef.current });
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  function clearSelection() {
    setSelected(null);
    sendToPreview({ type: 'clear-selection' });
  }

  // While reviewing, show the diff of the open file (or the first changed file).
  const reviewFile = review && (review[activeFile] ? activeFile : Object.keys(review)[0]);

  return (
    <div className="app-shell">
      <div className="top-row">
        <div className="left-pane">
          <div className="file-explorer">
            {Object.keys(files).filter((filePath) => !files[filePath].hidden).map((filePath) => (
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
              ↶ Undo
            </button>
            <button
              className="undo-button redo-button"
              onClick={redoLastChange}
              disabled={redoStack.length === 0 || review !== null}
              title="Redo the AI change you just undid"
            >
              ↷ Redo
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
          <div className="preview-toolbar">
            <button
              className={`select-button ${selecting ? 'active' : ''}`}
              onClick={() => setSelecting(!selecting)}
              title="Click an element in the preview to select it (Esc to cancel)"
            >
              🎯 {selecting ? 'Click an element… (Esc to cancel)' : 'Select element'}
            </button>
          </div>
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={true}
            style={{ flex: 1, minHeight: 0 }}
          />
        </div>
      </div>
      <div className="bottom-row">
        <ChatPanel
          reviewing={review !== null}
          onChange={startReview}
          selected={selected}
          onClearSelection={clearSelection}
        />
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