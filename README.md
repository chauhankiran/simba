# Simba Paint

A Paint-like image viewer and editor built with Electron.

## Features

### Drawing Tools
- **Pencil** - Freehand drawing with adjustable size
- **Brush** - Smooth brush strokes
- **Eraser** - Erase parts of the image
- **Fill Bucket** - Flood fill areas with color
- **Color Picker** - Pick colors from the canvas

### Shape Tools
- **Line** - Draw straight lines
- **Rectangle** - Draw rectangles (filled or outline)
- **Ellipse** - Draw ellipses/circles (filled or outline)
- **Triangle** - Draw triangles (filled or outline)
- **Text** - Add text with customizable font, size, and style

### Selection & Editing
- **Select** - Select rectangular areas
- **Cut/Copy/Paste** - Standard clipboard operations
- **Undo/Redo** - Up to 50 history states

### Image Operations
- **Open** - Open PNG, JPG, GIF, BMP, WebP images
- **Save/Save As** - Save as PNG, JPG, or BMP
- **Resize Canvas** - Change canvas dimensions
- **Crop to Selection** - Crop image to selected area
- **Flip Horizontal/Vertical** - Mirror the image
- **Rotate 90° CW/CCW** - Rotate the image

### View
- **Zoom In/Out** - Zoom from 10% to 800%
- **Reset Zoom** - Return to 100%

## Keyboard Shortcuts

### Tools
- `P` - Pencil
- `B` - Brush
- `E` - Eraser
- `G` - Fill Bucket
- `I` - Color Picker (Eyedropper)
- `L` - Line
- `R` - Rectangle
- `O` - Ellipse
- `T` - Triangle
- `X` - Text
- `S` - Select
- `[` / `]` - Decrease/Increase brush size
- `Escape` - Clear selection

### File & Edit
- `Ctrl+N` - New image
- `Ctrl+O` - Open image
- `Ctrl+S` - Save
- `Ctrl+Shift+S` - Save As
- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo
- `Ctrl+X` - Cut
- `Ctrl+C` - Copy
- `Ctrl+V` - Paste
- `Ctrl+A` - Select All

### View
- `Ctrl++` - Zoom In
- `Ctrl+-` - Zoom Out
- `Ctrl+0` - Reset Zoom

## Mouse Controls

- **Left Click** - Draw with primary color
- **Right Click** - Draw with secondary color (for pencil/brush)
- **Right Click on Color Palette** - Set secondary color

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

## Development

```bash
npm run dev
```

## License

MIT
