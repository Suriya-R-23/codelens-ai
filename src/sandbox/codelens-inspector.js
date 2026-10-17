// This file runs INSIDE the live preview (not in the editor app).
// It lets the user click an element in the preview to select it, and
// reports that element back to the editor using postMessage.

// Code changes can re-run this file, so only set it up once.
if (!window.__codelensInspector) {
  window.__codelensInspector = true;

  let selecting = false;

  // Two outline boxes drawn on top of the page: one follows the mouse,
  // one marks the selected element. They don't change the page's own styles.
  function makeBox(border) {
    const box = document.createElement('div');
    box.style.cssText = `position:fixed;pointer-events:none;z-index:2147483647;display:none;border:${border};border-radius:3px;`;
    document.documentElement.appendChild(box);
    return box;
  }
  const hoverBox = makeBox('2px dashed #2563eb');
  const selectedBox = makeBox('2px solid #f59e0b');
  let selectedElement = null;

  function placeBox(box, element) {
    if (!element || !element.isConnected) {
      box.style.display = 'none';
      return;
    }
    const rect = element.getBoundingClientRect();
    Object.assign(box.style, {
      display: 'block',
      left: `${rect.left - 2}px`,
      top: `${rect.top - 2}px`,
      width: `${rect.width + 4}px`,
      height: `${rect.height + 4}px`,
    });
  }

  function sendToEditor(message) {
    window.parent.postMessage({ source: 'codelens', ...message }, '*');
  }

  // A short description of the element that the AI can match to the code.
  function describe(element) {
    const path = [];
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      path.unshift(node.tagName.toLowerCase());
    }
    return {
      tag: element.tagName.toLowerCase(),
      text: (element.innerText || '').trim().slice(0, 80),
      id: element.id || '',
      className: typeof element.className === 'string' ? element.className : '',
      style: element.getAttribute('style') || '',
      path: path.join(' > '),
    };
  }

  function isPageElement(element) {
    return element && element !== document.documentElement && element !== document.body;
  }

  document.addEventListener('mouseover', (event) => {
    if (selecting && isPageElement(event.target)) placeBox(hoverBox, event.target);
  });

  // Capture the click before the page's own handlers, so selecting a button
  // doesn't also press it.
  document.addEventListener(
    'click',
    (event) => {
      if (!selecting || !isPageElement(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      selectedElement = event.target;
      placeBox(selectedBox, selectedElement);
      hoverBox.style.display = 'none';
      selecting = false;
      document.body.style.cursor = '';
      sendToEditor({ type: 'selected', element: describe(selectedElement) });
    },
    true,
  );

  document.addEventListener('keydown', (event) => {
    if (selecting && event.key === 'Escape') {
      selecting = false;
      hoverBox.style.display = 'none';
      document.body.style.cursor = '';
      sendToEditor({ type: 'cancelled' });
    }
  });

  // Keep the selected outline in place when the page scrolls or resizes.
  window.addEventListener('scroll', () => placeBox(selectedBox, selectedElement), true);
  window.addEventListener('resize', () => placeBox(selectedBox, selectedElement));

  // Messages from the editor: turn select mode on/off, or clear the selection.
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (event.source !== window.parent || !message || message.source !== 'codelens') return;
    if (message.type === 'select-mode') {
      selecting = message.on;
      document.body.style.cursor = selecting ? 'crosshair' : '';
      if (!selecting) hoverBox.style.display = 'none';
    }
    if (message.type === 'clear-selection') {
      selectedElement = null;
      selectedBox.style.display = 'none';
    }
  });

  sendToEditor({ type: 'ready' });
}
