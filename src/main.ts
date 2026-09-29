import { createJSONEditor, Mode, type Content } from 'vanilla-jsoneditor';
import 'vanilla-jsoneditor/themes/jse-theme-dark.css';
import './style.css';

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
