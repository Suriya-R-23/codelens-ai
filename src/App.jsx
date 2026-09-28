import { SandpackProvider, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react';
import Editor from '@monaco-editor/react';
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
          </div>
          <div className="editor-wrapper">
            <Editor
              height="100%"
              language={getLanguage(activeFile)}
              theme="vs-dark"
              value={files[activeFile].code}
              onChange={(value) => updateFile(activeFile, value ?? '')}
              options={{ minimap: { enabled: false }, fontSize: 14 }}
            />
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
        <ChatPanel />
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