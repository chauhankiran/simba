// Canvas and context references
const mainCanvas = document.getElementById('main-canvas');
const overlayCanvas = document.getElementById('overlay-canvas');
const ctx = mainCanvas.getContext('2d');
const overlayCtx = overlayCanvas.getContext('2d');
const canvasWrapper = document.getElementById('canvas-wrapper');
const canvasContainer = document.getElementById('canvas-container');

// State
let currentTool = 'pencil';
let primaryColor = '#000000';
let secondaryColor = '#ffffff';
let brushSize = 3;
let fillShape = false;
let zoom = 1;
let isDrawing = false;
let startX, startY;
let lastX, lastY;
let currentFilePath = null;
let showGrid = false;
let isDirty = false; // Track unsaved changes

// History for undo/redo
let history = [];
let historyIndex = -1;
const maxHistory = 50;

// Selection state
let selection = null;
let selectionData = null;
let clipboard = null;

// Floating selection (for paste operations)
let floatingSelection = null;
let isDraggingFloat = false;
let floatDragOffsetX = 0;
let floatDragOffsetY = 0;

// Text state
let textPosition = null;

// Mark canvas as modified
function setDirty(dirty = true) {
  isDirty = dirty;
  updateTitle();
}

function updateTitle() {
  const fileName = currentFilePath ? currentFilePath.split('/').pop() : 'Untitled';
  const dirtyMarker = isDirty ? ' *' : '';
  document.title = `${fileName}${dirtyMarker} - Simba Paint`;
}

// Initialize canvas
function initCanvas(width = 800, height = 600) {
  mainCanvas.width = width;
  mainCanvas.height = height;
  overlayCanvas.width = width;
  overlayCanvas.height = height;
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  updateCanvasSize();
  saveState();
  updateStatus();
  setDirty(false);
  updateTitle();
}

function updateCanvasSize() {
  const displayWidth = mainCanvas.width * zoom;
  const displayHeight = mainCanvas.height * zoom;
  
  canvasWrapper.style.width = displayWidth + 'px';
  canvasWrapper.style.height = displayHeight + 'px';
  
  mainCanvas.style.width = displayWidth + 'px';
  mainCanvas.style.height = displayHeight + 'px';
  overlayCanvas.style.width = displayWidth + 'px';
  overlayCanvas.style.height = displayHeight + 'px';
  
  document.getElementById('canvas-size').textContent = `${mainCanvas.width} x ${mainCanvas.height} px`;
  document.getElementById('zoom-level').textContent = `${Math.round(zoom * 100)}%`;
}

// History management
function saveState() {
  // Remove any states after current index
  history = history.slice(0, historyIndex + 1);
  
  // Save current state
  const imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
  history.push({
    imageData: imageData,
    width: mainCanvas.width,
    height: mainCanvas.height
  });
  
  // Limit history size
  if (history.length > maxHistory) {
    history.shift();
  } else {
    historyIndex++;
  }
  
  // Mark as dirty (modified) - but not on initial state
  if (history.length > 1) {
    setDirty(true);
  }
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    restoreState(history[historyIndex]);
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    restoreState(history[historyIndex]);
  }
}

function restoreState(state) {
  if (mainCanvas.width !== state.width || mainCanvas.height !== state.height) {
    mainCanvas.width = state.width;
    mainCanvas.height = state.height;
    overlayCanvas.width = state.width;
    overlayCanvas.height = state.height;
    updateCanvasSize();
  }
  ctx.putImageData(state.imageData, 0, 0);
  clearSelection();
}

// Get mouse position relative to canvas
function getMousePos(e) {
  const rect = mainCanvas.getBoundingClientRect();
  return {
    x: Math.floor((e.clientX - rect.left) / zoom),
    y: Math.floor((e.clientY - rect.top) / zoom)
  };
}

// Drawing functions
function drawLine(x1, y1, x2, y2, context = ctx, color = primaryColor, size = brushSize) {
  context.beginPath();
  context.strokeStyle = color;
  context.lineWidth = size;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function drawBrush(x1, y1, x2, y2, context = ctx, color = primaryColor, size = brushSize) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  
  for (let i = 0; i < dist; i += size / 4) {
    const x = x1 + Math.cos(angle) * i;
    const y = y1 + Math.sin(angle) * i;
    
    context.beginPath();
    context.fillStyle = color;
    context.arc(x, y, size / 2, 0, Math.PI * 2);
    context.fill();
  }
}

function erase(x1, y1, x2, y2) {
  ctx.globalCompositeOperation = 'destination-out';
  drawBrush(x1, y1, x2, y2, ctx, 'rgba(0,0,0,1)', brushSize);
  ctx.globalCompositeOperation = 'source-over';
  
  // Fill with white instead for eraser
  ctx.beginPath();
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = brushSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawRectangle(x1, y1, x2, y2, context = ctx, preview = false) {
  const color = preview ? primaryColor : primaryColor;
  context.beginPath();
  context.strokeStyle = color;
  context.lineWidth = brushSize;
  context.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  
  if (fillShape) {
    context.fillStyle = primaryColor;
    context.fill();
  }
  context.stroke();
}

function drawEllipse(x1, y1, x2, y2, context = ctx) {
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const radiusX = Math.abs(x2 - x1) / 2;
  const radiusY = Math.abs(y2 - y1) / 2;
  
  context.beginPath();
  context.strokeStyle = primaryColor;
  context.lineWidth = brushSize;
  context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  
  if (fillShape) {
    context.fillStyle = primaryColor;
    context.fill();
  }
  context.stroke();
}

function drawTriangle(x1, y1, x2, y2, context = ctx) {
  const topX = (x1 + x2) / 2;
  const topY = Math.min(y1, y2);
  const bottomY = Math.max(y1, y2);
  const leftX = Math.min(x1, x2);
  const rightX = Math.max(x1, x2);
  
  context.beginPath();
  context.strokeStyle = primaryColor;
  context.lineWidth = brushSize;
  context.moveTo(topX, topY);
  context.lineTo(rightX, bottomY);
  context.lineTo(leftX, bottomY);
  context.closePath();
  
  if (fillShape) {
    context.fillStyle = primaryColor;
    context.fill();
  }
  context.stroke();
}

function drawStraightLine(x1, y1, x2, y2, context = ctx) {
  context.beginPath();
  context.strokeStyle = primaryColor;
  context.lineWidth = brushSize;
  context.lineCap = 'round';
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

// Flood fill algorithm
function floodFill(startX, startY, fillColor) {
  const imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
  const data = imageData.data;
  const width = mainCanvas.width;
  const height = mainCanvas.height;
  
  const startPos = (startY * width + startX) * 4;
  const startR = data[startPos];
  const startG = data[startPos + 1];
  const startB = data[startPos + 2];
  const startA = data[startPos + 3];
  
  // Parse fill color
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.fillStyle = fillColor;
  tempCtx.fillRect(0, 0, 1, 1);
  const fillData = tempCtx.getImageData(0, 0, 1, 1).data;
  const fillR = fillData[0];
  const fillG = fillData[1];
  const fillB = fillData[2];
  const fillA = fillData[3];
  
  // Don't fill if same color
  if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) {
    return;
  }
  
  const tolerance = 32;
  
  function matchesStart(pos) {
    return Math.abs(data[pos] - startR) <= tolerance &&
           Math.abs(data[pos + 1] - startG) <= tolerance &&
           Math.abs(data[pos + 2] - startB) <= tolerance &&
           Math.abs(data[pos + 3] - startA) <= tolerance;
  }
  
  function setPixel(pos) {
    data[pos] = fillR;
    data[pos + 1] = fillG;
    data[pos + 2] = fillB;
    data[pos + 3] = fillA;
  }
  
  const stack = [[startX, startY]];
  const visited = new Set();
  
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const key = `${x},${y}`;
    
    if (visited.has(key)) continue;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    
    const pos = (y * width + x) * 4;
    if (!matchesStart(pos)) continue;
    
    visited.add(key);
    setPixel(pos);
    
    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }
  
  ctx.putImageData(imageData, 0, 0);
}

// Eyedropper
function pickColor(x, y) {
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const color = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;
  return color;
}

// Selection functions
function clearSelection() {
  selection = null;
  selectionData = null;
  // Also clear floating selection without committing
  if (floatingSelection) {
    cancelFloatingSelection();
  }
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

function drawSelectionRect(x1, y1, x2, y2) {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  
  overlayCtx.setLineDash([5, 5]);
  overlayCtx.strokeStyle = '#000000';
  overlayCtx.lineWidth = 1;
  overlayCtx.strokeRect(x + 0.5, y + 0.5, w, h);
  overlayCtx.setLineDash([]);
}

function finalizeSelection(x1, y1, x2, y2) {
  selection = {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1)
  };
  
  if (selection.width > 0 && selection.height > 0) {
    selectionData = ctx.getImageData(selection.x, selection.y, selection.width, selection.height);
  }
}

// Copy/Cut/Paste
function copySelection() {
  if (selection && selectionData) {
    clipboard = {
      imageData: selectionData,
      width: selection.width,
      height: selection.height
    };
  }
}

function cutSelection() {
  if (selection && selectionData) {
    copySelection();
    ctx.fillStyle = secondaryColor;
    ctx.fillRect(selection.x, selection.y, selection.width, selection.height);
    saveState();
    clearSelection();
  }
}

function paste() {
  // Commit any existing floating selection first
  commitFloatingSelection();
  
  if (clipboard) {
    // Create a floating selection at center of visible area
    const containerRect = canvasContainer.getBoundingClientRect();
    const scrollLeft = canvasContainer.scrollLeft;
    const scrollTop = canvasContainer.scrollTop;
    
    // Calculate center of visible area in canvas coordinates
    const visibleCenterX = (scrollLeft + containerRect.width / 2) / zoom;
    const visibleCenterY = (scrollTop + containerRect.height / 2) / zoom;
    
    // Position floating selection at center
    const x = Math.max(0, Math.floor(visibleCenterX - clipboard.width / 2));
    const y = Math.max(0, Math.floor(visibleCenterY - clipboard.height / 2));
    
    floatingSelection = {
      imageData: clipboard.imageData,
      x: x,
      y: y,
      width: clipboard.width,
      height: clipboard.height
    };
    
    // Switch to select tool for moving
    selectTool('select');
    drawFloatingSelection();
  }
}

function drawFloatingSelection() {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  
  if (floatingSelection) {
    // Draw the floating image
    overlayCtx.putImageData(floatingSelection.imageData, floatingSelection.x, floatingSelection.y);
    
    // Draw selection border (marching ants effect)
    overlayCtx.setLineDash([5, 5]);
    overlayCtx.strokeStyle = '#000000';
    overlayCtx.lineWidth = 1;
    overlayCtx.strokeRect(
      floatingSelection.x + 0.5,
      floatingSelection.y + 0.5,
      floatingSelection.width,
      floatingSelection.height
    );
    overlayCtx.setLineDash([]);
  }
}

function commitFloatingSelection() {
  if (floatingSelection) {
    // Draw the floating selection onto the main canvas
    ctx.putImageData(floatingSelection.imageData, floatingSelection.x, floatingSelection.y);
    floatingSelection = null;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    saveState();
  }
}

function cancelFloatingSelection() {
  floatingSelection = null;
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

function isPointInFloatingSelection(x, y) {
  if (!floatingSelection) return false;
  return x >= floatingSelection.x && 
         x <= floatingSelection.x + floatingSelection.width &&
         y >= floatingSelection.y && 
         y <= floatingSelection.y + floatingSelection.height;
}

// Mouse event handlers
mainCanvas.addEventListener('mousedown', (e) => {
  const pos = getMousePos(e);
  isDrawing = true;
  startX = pos.x;
  startY = pos.y;
  lastX = pos.x;
  lastY = pos.y;
  
  // Check if clicking on floating selection to drag it
  if (floatingSelection && currentTool === 'select') {
    if (isPointInFloatingSelection(pos.x, pos.y)) {
      isDraggingFloat = true;
      floatDragOffsetX = pos.x - floatingSelection.x;
      floatDragOffsetY = pos.y - floatingSelection.y;
      isDrawing = false;
      return;
    } else {
      // Clicking outside floating selection commits it
      commitFloatingSelection();
    }
  }
  
  if (currentTool === 'fill') {
    floodFill(pos.x, pos.y, e.button === 2 ? secondaryColor : primaryColor);
    saveState();
    isDrawing = false;
  } else if (currentTool === 'eyedropper') {
    const color = pickColor(pos.x, pos.y);
    if (e.button === 2) {
      secondaryColor = color;
      document.getElementById('secondary-color').value = color;
      document.getElementById('secondary-swatch').style.background = color;
    } else {
      primaryColor = color;
      document.getElementById('primary-color').value = color;
      document.getElementById('primary-swatch').style.background = color;
    }
    isDrawing = false;
  } else if (currentTool === 'text') {
    textPosition = { x: pos.x, y: pos.y };
    showTextModal();
    isDrawing = false;
  } else if (currentTool === 'pencil' || currentTool === 'brush' || currentTool === 'eraser') {
    // Draw a single point
    if (currentTool === 'eraser') {
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = e.button === 2 ? secondaryColor : primaryColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
});

mainCanvas.addEventListener('mousemove', (e) => {
  const pos = getMousePos(e);
  document.getElementById('cursor-pos').textContent = `${pos.x}, ${pos.y} px`;
  
  // Handle dragging floating selection
  if (isDraggingFloat && floatingSelection) {
    floatingSelection.x = Math.max(0, Math.min(mainCanvas.width - floatingSelection.width, pos.x - floatDragOffsetX));
    floatingSelection.y = Math.max(0, Math.min(mainCanvas.height - floatingSelection.height, pos.y - floatDragOffsetY));
    drawFloatingSelection();
    return;
  }
  
  // Update cursor for floating selection
  if (floatingSelection && currentTool === 'select' && isPointInFloatingSelection(pos.x, pos.y)) {
    mainCanvas.style.cursor = 'move';
  } else if (currentTool === 'select') {
    mainCanvas.style.cursor = 'crosshair';
  }
  
  if (!isDrawing) return;
  
  const color = e.buttons === 2 ? secondaryColor : primaryColor;
  
  switch (currentTool) {
    case 'pencil':
      drawLine(lastX, lastY, pos.x, pos.y, ctx, color, brushSize);
      break;
    case 'brush':
      drawBrush(lastX, lastY, pos.x, pos.y, ctx, color, brushSize);
      break;
    case 'eraser':
      erase(lastX, lastY, pos.x, pos.y);
      break;
    case 'line':
    case 'rectangle':
    case 'ellipse':
    case 'triangle':
      // Preview on overlay
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      overlayCtx.strokeStyle = primaryColor;
      overlayCtx.fillStyle = primaryColor;
      overlayCtx.lineWidth = brushSize;
      
      if (currentTool === 'line') {
        overlayCtx.beginPath();
        overlayCtx.moveTo(startX, startY);
        overlayCtx.lineTo(pos.x, pos.y);
        overlayCtx.stroke();
      } else if (currentTool === 'rectangle') {
        drawRectangle(startX, startY, pos.x, pos.y, overlayCtx, true);
      } else if (currentTool === 'ellipse') {
        drawEllipse(startX, startY, pos.x, pos.y, overlayCtx);
      } else if (currentTool === 'triangle') {
        drawTriangle(startX, startY, pos.x, pos.y, overlayCtx);
      }
      break;
    case 'select':
      drawSelectionRect(startX, startY, pos.x, pos.y);
      break;
  }
  
  lastX = pos.x;
  lastY = pos.y;
});

mainCanvas.addEventListener('mouseup', (e) => {
  // End floating selection drag
  if (isDraggingFloat) {
    isDraggingFloat = false;
    return;
  }
  
  if (!isDrawing) return;
  
  const pos = getMousePos(e);
  
  switch (currentTool) {
    case 'line':
      drawStraightLine(startX, startY, pos.x, pos.y);
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      saveState();
      break;
    case 'rectangle':
      drawRectangle(startX, startY, pos.x, pos.y);
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      saveState();
      break;
    case 'ellipse':
      drawEllipse(startX, startY, pos.x, pos.y);
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      saveState();
      break;
    case 'triangle':
      drawTriangle(startX, startY, pos.x, pos.y);
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      saveState();
      break;
    case 'select':
      finalizeSelection(startX, startY, pos.x, pos.y);
      break;
    case 'pencil':
    case 'brush':
    case 'eraser':
      saveState();
      break;
  }
  
  isDrawing = false;
});

mainCanvas.addEventListener('mouseleave', () => {
  if (isDrawing && (currentTool === 'pencil' || currentTool === 'brush' || currentTool === 'eraser')) {
    saveState();
  }
  isDrawing = false;
});

// Prevent context menu
mainCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Tool selection
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
    
    if (currentTool !== 'select') {
      clearSelection();
    }
  });
});

// Brush size
const brushSizeSlider = document.getElementById('brush-size');
const sizeValue = document.getElementById('size-value');
brushSizeSlider.addEventListener('input', () => {
  brushSize = parseInt(brushSizeSlider.value);
  sizeValue.textContent = brushSize;
});

// Fill shape checkbox
document.getElementById('fill-shape').addEventListener('change', (e) => {
  fillShape = e.target.checked;
});

// Color pickers
const primaryColorInput = document.getElementById('primary-color');
const secondaryColorInput = document.getElementById('secondary-color');
const primarySwatch = document.getElementById('primary-swatch');
const secondarySwatch = document.getElementById('secondary-swatch');

primaryColorInput.addEventListener('input', (e) => {
  primaryColor = e.target.value;
  primarySwatch.style.background = primaryColor;
});

secondaryColorInput.addEventListener('input', (e) => {
  secondaryColor = e.target.value;
  secondarySwatch.style.background = secondaryColor;
});

// Initialize color swatches
primarySwatch.style.background = primaryColor;
secondarySwatch.style.background = secondaryColor;

// Color palette
const paletteColors = [
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27',
  '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
  '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e',
  '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7'
];

const colorPalette = document.getElementById('color-palette');
paletteColors.forEach(color => {
  const swatch = document.createElement('div');
  swatch.className = 'palette-color';
  swatch.style.background = color;
  swatch.addEventListener('click', () => {
    primaryColor = color;
    primaryColorInput.value = color;
    primarySwatch.style.background = color;
  });
  swatch.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    secondaryColor = color;
    secondaryColorInput.value = color;
    secondarySwatch.style.background = color;
  });
  colorPalette.appendChild(swatch);
});

// Zoom controls
document.getElementById('zoom-in').addEventListener('click', () => {
  if (zoom < 8) {
    zoom = Math.min(8, zoom * 1.25);
    updateCanvasSize();
  }
});

document.getElementById('zoom-out').addEventListener('click', () => {
  if (zoom > 0.1) {
    zoom = Math.max(0.1, zoom / 1.25);
    updateCanvasSize();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  const key = e.key.toLowerCase();
  
  // Tool shortcuts
  if (!e.ctrlKey && !e.metaKey) {
    switch (key) {
      case 'p': selectTool('pencil'); break;
      case 'b': selectTool('brush'); break;
      case 'e': selectTool('eraser'); break;
      case 'g': selectTool('fill'); break;
      case 'i': selectTool('eyedropper'); break;
      case 'l': selectTool('line'); break;
      case 'r': selectTool('rectangle'); break;
      case 'o': selectTool('ellipse'); break;
      case 't': selectTool('triangle'); break;
      case 'x': selectTool('text'); break;
      case 's': selectTool('select'); break;
      case 'escape': 
        if (floatingSelection) {
          cancelFloatingSelection();
        } else {
          clearSelection();
        }
        break;
      case 'enter':
        if (floatingSelection) {
          commitFloatingSelection();
        }
        break;
    }
  }
  
  // Ctrl+key shortcuts
  if (e.ctrlKey || e.metaKey) {
    switch (key) {
      case 'c':
        copySelection();
        e.preventDefault();
        break;
      case 'x':
        cutSelection();
        e.preventDefault();
        break;
      case 'v':
        paste();
        e.preventDefault();
        break;
      case 'z':
        undo();
        e.preventDefault();
        break;
      case 'y':
        redo();
        e.preventDefault();
        break;
    }
  }
  
  // Brush size with [ and ]
  if (key === '[') {
    brushSize = Math.max(1, brushSize - 1);
    brushSizeSlider.value = brushSize;
    sizeValue.textContent = brushSize;
  } else if (key === ']') {
    brushSize = Math.min(50, brushSize + 1);
    brushSizeSlider.value = brushSize;
    sizeValue.textContent = brushSize;
  }
});

function selectTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-tool="${tool}"]`);
  if (btn) btn.classList.add('active');
  
  if (tool !== 'select') {
    clearSelection();
  }
}

// Resize modal
const resizeModal = document.getElementById('resize-modal');
const resizeWidth = document.getElementById('resize-width');
const resizeHeight = document.getElementById('resize-height');

function showResizeModal() {
  resizeWidth.value = mainCanvas.width;
  resizeHeight.value = mainCanvas.height;
  resizeModal.classList.add('active');
}

document.getElementById('resize-cancel').addEventListener('click', () => {
  resizeModal.classList.remove('active');
});

document.getElementById('resize-ok').addEventListener('click', () => {
  const newWidth = parseInt(resizeWidth.value);
  const newHeight = parseInt(resizeHeight.value);
  
  if (newWidth > 0 && newHeight > 0) {
    const imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
    mainCanvas.width = newWidth;
    mainCanvas.height = newHeight;
    overlayCanvas.width = newWidth;
    overlayCanvas.height = newHeight;
    
    ctx.fillStyle = secondaryColor;
    ctx.fillRect(0, 0, newWidth, newHeight);
    ctx.putImageData(imageData, 0, 0);
    
    updateCanvasSize();
    saveState();
  }
  
  resizeModal.classList.remove('active');
});

// Text modal
const textModal = document.getElementById('text-modal');

function showTextModal() {
  document.getElementById('text-input').value = '';
  textModal.classList.add('active');
  document.getElementById('text-input').focus();
}

document.getElementById('text-cancel').addEventListener('click', () => {
  textModal.classList.remove('active');
  textPosition = null;
});

document.getElementById('text-ok').addEventListener('click', () => {
  const text = document.getElementById('text-input').value;
  if (text && textPosition) {
    const font = document.getElementById('text-font').value;
    const size = document.getElementById('text-size').value;
    const bold = document.getElementById('text-bold').checked;
    const italic = document.getElementById('text-italic').checked;
    
    let fontStyle = '';
    if (italic) fontStyle += 'italic ';
    if (bold) fontStyle += 'bold ';
    fontStyle += `${size}px ${font}`;
    
    ctx.font = fontStyle;
    ctx.fillStyle = primaryColor;
    ctx.fillText(text, textPosition.x, textPosition.y);
    
    saveState();
  }
  
  textModal.classList.remove('active');
  textPosition = null;
});

// Scale image modal
const scaleModal = document.getElementById('scale-modal');
const scaleRatioSelect = document.getElementById('scale-ratio');
const scaleCustomInput = document.getElementById('scale-custom');
const customRatioGroup = document.getElementById('custom-ratio-group');
const scaleCurrentSize = document.getElementById('scale-current-size');
const scaleNewSize = document.getElementById('scale-new-size');

function showScaleModal() {
  scaleCurrentSize.textContent = `${mainCanvas.width} x ${mainCanvas.height} px`;
  scaleRatioSelect.value = '1';
  scaleCustomInput.value = '100';
  customRatioGroup.style.display = 'none';
  updateScalePreview();
  scaleModal.classList.add('active');
}

function updateScalePreview() {
  let ratio;
  if (scaleRatioSelect.value === 'custom') {
    ratio = parseFloat(scaleCustomInput.value) / 100;
  } else {
    ratio = parseFloat(scaleRatioSelect.value);
  }
  
  if (isNaN(ratio) || ratio <= 0) ratio = 1;
  
  const newWidth = Math.round(mainCanvas.width * ratio);
  const newHeight = Math.round(mainCanvas.height * ratio);
  scaleNewSize.textContent = `${newWidth} x ${newHeight} px`;
}

scaleRatioSelect.addEventListener('change', () => {
  if (scaleRatioSelect.value === 'custom') {
    customRatioGroup.style.display = 'flex';
  } else {
    customRatioGroup.style.display = 'none';
  }
  updateScalePreview();
});

scaleCustomInput.addEventListener('input', updateScalePreview);

document.getElementById('scale-cancel').addEventListener('click', () => {
  scaleModal.classList.remove('active');
});

document.getElementById('scale-ok').addEventListener('click', () => {
  let ratio;
  if (scaleRatioSelect.value === 'custom') {
    ratio = parseFloat(scaleCustomInput.value) / 100;
  } else {
    ratio = parseFloat(scaleRatioSelect.value);
  }
  
  if (isNaN(ratio) || ratio <= 0) {
    scaleModal.classList.remove('active');
    return;
  }
  
  scaleImage(ratio);
  scaleModal.classList.remove('active');
});

function scaleImage(ratio) {
  if (ratio === 1) return; // No change needed
  
  const newWidth = Math.round(mainCanvas.width * ratio);
  const newHeight = Math.round(mainCanvas.height * ratio);
  
  if (newWidth < 1 || newHeight < 1 || newWidth > 8192 || newHeight > 8192) {
    return; // Invalid dimensions
  }
  
  // Create temp canvas with current image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = mainCanvas.width;
  tempCanvas.height = mainCanvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(mainCanvas, 0, 0);
  
  // Resize main canvas
  mainCanvas.width = newWidth;
  mainCanvas.height = newHeight;
  overlayCanvas.width = newWidth;
  overlayCanvas.height = newHeight;
  
  // Enable image smoothing for better quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Draw scaled image
  ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
  
  updateCanvasSize();
  saveState();
}

// Image transformations
function flipHorizontal() {
  const imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(mainCanvas, -mainCanvas.width, 0);
  ctx.restore();
  saveState();
}

function flipVertical() {
  const imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
  ctx.save();
  ctx.scale(1, -1);
  ctx.drawImage(mainCanvas, 0, -mainCanvas.height);
  ctx.restore();
  saveState();
}

function rotateClockwise() {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = mainCanvas.width;
  tempCanvas.height = mainCanvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(mainCanvas, 0, 0);
  
  const newWidth = mainCanvas.height;
  const newHeight = mainCanvas.width;
  
  mainCanvas.width = newWidth;
  mainCanvas.height = newHeight;
  overlayCanvas.width = newWidth;
  overlayCanvas.height = newHeight;
  
  ctx.save();
  ctx.translate(newWidth, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.restore();
  
  updateCanvasSize();
  saveState();
}

function rotateCounterClockwise() {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = mainCanvas.width;
  tempCanvas.height = mainCanvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(mainCanvas, 0, 0);
  
  const newWidth = mainCanvas.height;
  const newHeight = mainCanvas.width;
  
  mainCanvas.width = newWidth;
  mainCanvas.height = newHeight;
  overlayCanvas.width = newWidth;
  overlayCanvas.height = newHeight;
  
  ctx.save();
  ctx.translate(0, newHeight);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.restore();
  
  updateCanvasSize();
  saveState();
}

function cropToSelection() {
  if (selection && selection.width > 0 && selection.height > 0) {
    const imageData = ctx.getImageData(selection.x, selection.y, selection.width, selection.height);
    
    mainCanvas.width = selection.width;
    mainCanvas.height = selection.height;
    overlayCanvas.width = selection.width;
    overlayCanvas.height = selection.height;
    
    ctx.putImageData(imageData, 0, 0);
    
    updateCanvasSize();
    clearSelection();
    saveState();
  }
}

// File operations
function newImage() {
  showResizeModal();
}

function openImage(dataUrl, filePath) {
  const img = new Image();
  img.onload = () => {
    mainCanvas.width = img.width;
    mainCanvas.height = img.height;
    overlayCanvas.width = img.width;
    overlayCanvas.height = img.height;
    
    ctx.drawImage(img, 0, 0);
    
    currentFilePath = filePath;
    updateCanvasSize();
    updateStatus();
    
    // Reset history
    history = [];
    historyIndex = -1;
    saveState();
    setDirty(false); // Opening a file starts clean
    updateTitle();
  };
  img.src = dataUrl;
}

async function saveImage(saveAs = false) {
  const format = currentFilePath ? currentFilePath.split('.').pop().toLowerCase() : 'png';
  let mimeType = 'image/png';
  if (format === 'jpg' || format === 'jpeg') mimeType = 'image/jpeg';
  
  const dataUrl = mainCanvas.toDataURL(mimeType);
  
  const result = await window.electronAPI.saveFile({
    dataUrl,
    filePath: saveAs ? null : currentFilePath
  });
  
  if (result.success) {
    currentFilePath = result.filePath;
    setDirty(false); // Clear dirty flag after successful save
    updateStatus();
  }
  
  return result.success;
}

function updateStatus() {
  const fileName = currentFilePath ? currentFilePath.split('/').pop() : 'Untitled';
  document.getElementById('file-name').textContent = fileName;
}

// Electron IPC handlers
window.electronAPI.onMenuNew(() => newImage());
window.electronAPI.onFileOpened((dataUrl, filePath) => openImage(dataUrl, filePath));
window.electronAPI.onMenuSave(() => saveImage(false));
window.electronAPI.onMenuSaveAs(() => saveImage(true));
window.electronAPI.onMenuUndo(() => undo());
window.electronAPI.onMenuRedo(() => redo());
window.electronAPI.onMenuCut(() => cutSelection());
window.electronAPI.onMenuCopy(() => copySelection());
window.electronAPI.onMenuPaste(() => paste());
window.electronAPI.onMenuSelectAll(() => {
  selectTool('select');
  selection = { x: 0, y: 0, width: mainCanvas.width, height: mainCanvas.height };
  selectionData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
  drawSelectionRect(0, 0, mainCanvas.width, mainCanvas.height);
});
window.electronAPI.onMenuClearSelection(() => clearSelection());
window.electronAPI.onMenuResize(() => showResizeModal());
window.electronAPI.onMenuScale(() => showScaleModal());
window.electronAPI.onMenuCrop(() => cropToSelection());
window.electronAPI.onMenuFlipHorizontal(() => flipHorizontal());
window.electronAPI.onMenuFlipVertical(() => flipVertical());
window.electronAPI.onMenuRotateCW(() => rotateClockwise());
window.electronAPI.onMenuRotateCCW(() => rotateCounterClockwise());
window.electronAPI.onMenuZoomIn(() => {
  if (zoom < 8) {
    zoom = Math.min(8, zoom * 1.25);
    updateCanvasSize();
  }
});
window.electronAPI.onMenuZoomOut(() => {
  if (zoom > 0.1) {
    zoom = Math.max(0.1, zoom / 1.25);
    updateCanvasSize();
  }
});
window.electronAPI.onMenuZoomReset(() => {
  zoom = 1;
  updateCanvasSize();
});
window.electronAPI.onMenuToggleGrid(() => {
  showGrid = !showGrid;
  // Grid implementation can be added here
});

// Handle dirty status check from main process (for close confirmation)
window.electronAPI.onCheckDirty(() => {
  window.electronAPI.sendDirtyStatus(isDirty);
});

// Handle save-and-close request from main process
window.electronAPI.onSaveAndClose(async () => {
  const success = await saveImage(false);
  window.electronAPI.sendSaveComplete(success);
});

// Initialize
initCanvas();
