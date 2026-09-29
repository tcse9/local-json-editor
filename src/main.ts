import { createJSONEditor, Mode, type Content } from 'vanilla-jsoneditor';
import 'vanilla-jsoneditor/themes/jse-theme-dark.css';
import './style.css';
import type { CurlResult } from './curl-api';

type JSONEditorInstance = ReturnType<typeof createJSONEditor>;

const sampleContent: Content = {
  json: {
    greeting: 'Welcome to your local JSON editor',
    tips: [
      'Drag the middle bar to resize the two panels',
      'Use the toolbar to switch between text, tree and table view',
      'Use Open / Save to import or export a .json file',
      'The sort/filter icons and search work per panel',
    ],
  },
};

function createEditor(mount: HTMLDivElement): JSONEditorInstance {
  mount.classList.add('jse-theme-dark');
  return createJSONEditor({
    target: mount,
    props: {
      content: structuredClone(sampleContent),
      mode: Mode.tree,
      mainMenuBar: true,
      navigationBar: true,
      statusBar: true,
    },
  });
}

function contentToText(content: Content): string {
  if ('text' in content) {
    return content.text;
  }
  return JSON.stringify(content.json, null, 2);
}

function setupPanel(panel: HTMLElement): { editor: JSONEditorInstance } {
  const mount = panel.querySelector('.editor-mount') as HTMLDivElement;
  const fileInput = panel.querySelector('.file-input') as HTMLInputElement;
  const openBtn = panel.querySelector('.open-btn') as HTMLButtonElement;
  const saveBtn = panel.querySelector('.save-btn') as HTMLButtonElement;
  const titleEl = panel.querySelector('.panel-title') as HTMLElement;

  const editor = createEditor(mount);

  openBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    editor.updateProps({ content: { text } });
    titleEl.textContent = file.name;
    fileInput.value = '';
  });

  saveBtn.addEventListener('click', () => {
    const text = contentToText(editor.get());
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const suggestedName = titleEl.textContent?.endsWith('.json')
      ? titleEl.textContent
      : `${titleEl.textContent || 'document'}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  return { editor };
}

const leftPanel = document.getElementById('left-panel') as HTMLElement;
const rightPanel = document.getElementById('right-panel') as HTMLElement;

const { editor: leftEditor } = setupPanel(leftPanel);
const { editor: rightEditor } = setupPanel(rightPanel);

// --- Copy between panels -----------------------------------------------

document.getElementById('copy-to-left')!.addEventListener('click', () => {
  const content = rightEditor.get();
  leftEditor.updateProps({ content });
});

document.getElementById('copy-to-right')!.addEventListener('click', () => {
  const content = leftEditor.get();
  rightEditor.updateProps({ content });
});

// --- Resizable splitter --------------------------------------------------

const splitter = document.getElementById('splitter')!;
const handle = splitter.querySelector('.splitter-handle') as HTMLElement;
const app = document.getElementById('app')!;

const MIN_PANEL_WIDTH = 240;

let dragging = false;

handle.addEventListener('mousedown', (event) => {
  dragging = true;
  handle.classList.add('dragging');
  event.preventDefault();
});

window.addEventListener('mousemove', (event) => {
  if (!dragging) return;

  const appRect = app.getBoundingClientRect();
  const splitterWidth = splitter.getBoundingClientRect().width;
  const maxLeftWidth = appRect.width - splitterWidth - MIN_PANEL_WIDTH;
  let leftWidth = event.clientX - appRect.left;

  leftWidth = Math.max(MIN_PANEL_WIDTH, Math.min(leftWidth, maxLeftWidth));
  leftPanel.style.width = `${leftWidth}px`;
});

window.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  handle.classList.remove('dragging');
});

// --- Curl executor ---------------------------------------------------------

const curlToggle = document.getElementById('curl-toggle') as HTMLButtonElement;
const curlPanel = document.getElementById('curl-panel') as HTMLElement;
const curlInput = document.getElementById('curl-input') as HTMLTextAreaElement;
const curlInputToggle = document.getElementById('curl-input-toggle') as HTMLButtonElement;
const curlRunBtn = document.getElementById('curl-run') as HTMLButtonElement;
const curlStatus = document.getElementById('curl-status') as HTMLElement;
const curlStdout = document.getElementById('curl-stdout') as HTMLElement;
const curlResponseToggle = document.getElementById('curl-response-toggle') as HTMLButtonElement;
const curlResponseSize = document.getElementById('curl-response-size') as HTMLElement;
const curlStderr = document.getElementById('curl-stderr') as HTMLElement;
const curlStderrSection = document.getElementById('curl-stderr-section') as HTMLElement;
const curlStderrToggle = document.getElementById('curl-stderr-toggle') as HTMLButtonElement;
const curlSendLeft = document.getElementById('curl-send-left') as HTMLButtonElement;
const curlSendRight = document.getElementById('curl-send-right') as HTMLButtonElement;

let lastCurlJsonText: string | null = null;

curlToggle.addEventListener('click', () => {
  curlPanel.hidden = !curlPanel.hidden;
  if (!curlPanel.hidden) curlInput.focus();
});

function toggleSection(toggle: HTMLButtonElement, content: HTMLElement): void {
  const expanded = toggle.getAttribute('aria-expanded') !== 'false';
  toggle.setAttribute('aria-expanded', String(!expanded));
  content.hidden = expanded;
}

curlInputToggle.addEventListener('click', () => toggleSection(curlInputToggle, curlInput));
curlResponseToggle.addEventListener('click', () => toggleSection(curlResponseToggle, curlStdout));
curlStderrToggle.addEventListener('click', () => toggleSection(curlStderrToggle, curlStderr));

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function execCurl(command: string): Promise<CurlResult> {
  // Electron build: run curl in the main process over IPC.
  if (window.curlAPI) {
    return window.curlAPI.run(command);
  }

  // Browser build served by `vite`/`vite preview`: same exec, done by the
  // Node dev/preview server instead of the (sandboxed, CORS-bound) page.
  try {
    const response = await fetch('/api/curl-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    return (await response.json()) as CurlResult;
  } catch {
    return {
      ok: false,
      error: 'Could not reach the curl proxy. This only works when the app is served by `vite`/`vite preview` or the Electron build.',
    };
  }
}

async function runCurl(): Promise<void> {
  const command = curlInput.value.trim();
  if (!command) return;

  curlRunBtn.disabled = true;
  curlStatus.textContent = 'Running…';
  curlStdout.textContent = '';
  curlResponseSize.textContent = '';
  curlStderr.textContent = '';
  curlStderrSection.hidden = true;
  curlSendLeft.disabled = true;
  curlSendRight.disabled = true;
  lastCurlJsonText = null;

  const result = await execCurl(command);
  curlRunBtn.disabled = false;

  if (!result.ok) {
    curlStatus.textContent = `Error: ${result.error}`;
    return;
  }

  curlStatus.textContent = `Exit code ${result.exitCode}`;
  curlStdout.textContent = result.stdout || '(empty response)';
  curlResponseSize.textContent = result.stdout ? ` (${formatBytes(new Blob([result.stdout]).size)})` : '';

  if (result.stderr.trim()) {
    curlStderr.textContent = result.stderr;
    curlStderrSection.hidden = false;
  }

  try {
    JSON.parse(result.stdout);
    lastCurlJsonText = result.stdout;
    curlSendLeft.disabled = false;
    curlSendRight.disabled = false;
  } catch {
    lastCurlJsonText = null;
  }
}

curlRunBtn.addEventListener('click', () => void runCurl());

curlInput.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    void runCurl();
  }
});

curlSendLeft.addEventListener('click', () => {
  if (!lastCurlJsonText) return;
  leftEditor.updateProps({ content: { text: lastCurlJsonText } });
});

curlSendRight.addEventListener('click', () => {
  if (!lastCurlJsonText) return;
  rightEditor.updateProps({ content: { text: lastCurlJsonText } });
});
