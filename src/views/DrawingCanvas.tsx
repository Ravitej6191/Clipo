import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Undo2, Redo2, Trash2, Pen, Eraser, Circle, Minus } from 'lucide-react';

interface Props {
  onSave: (dataUrl: string) => void;
  onClose: () => void;
  initialDataUrl?: string;
}

type Tool = 'pen' | 'eraser' | 'circle' | 'line';

const COLORS = ['#111827','#4A8CFF','#7C3AED','#EF4444','#F59E0B','#22C55E','#EC4899','#FFFFFF'];
const COLOR_NAMES: Record<string, string> = {
  '#111827': 'Black', '#4A8CFF': 'Blue', '#7C3AED': 'Purple',
  '#EF4444': 'Red', '#F59E0B': 'Amber', '#22C55E': 'Green',
  '#EC4899': 'Pink', '#FFFFFF': 'White',
};

const DrawingCanvas: React.FC<Props> = ({ onSave, onClose, initialDataUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#111827');
  const [size, setSize] = useState(3);

  // Resize canvas — preserve existing drawing by snapshotting before resize
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Snapshot current pixels before resizing erases them
    const ctx = canvas.getContext('2d');
    const snapshot = (canvas.width > 0 && canvas.height > 0 && ctx)
      ? canvas.toDataURL()
      : null;

    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    if (ctx) ctx.scale(dpr, dpr);

    // Restore snapshot (beats initialDataUrl — user may have drawn over it)
    const src = snapshot || initialDataUrl;
    if (src) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => ctx?.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = src;
    }
  }, [initialDataUrl]);

  useEffect(() => {
    resize();
    // Only listen to orientationchange to avoid wiping on virtual keyboard appear
    window.addEventListener('orientationchange', resize);
    return () => window.removeEventListener('orientationchange', resize);
  }, [resize]);

  const getXY = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const saveSnapshot = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    redoStack.current = [];
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || undoStack.current.length === 0) return;
    redoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    const snap = undoStack.current.pop()!;
    ctx.putImageData(snap, 0, 0);
  };

  const redo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || redoStack.current.length === 0) return;
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    const snap = redoStack.current.pop()!;
    ctx.putImageData(snap, 0, 0);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    saveSnapshot();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const onPointerDown = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawingRef.current = true;
    saveSnapshot();
    const pt = getXY(e);
    lastPoint.current = pt;
    startPoint.current = pt;
    if (tool === 'pen' || tool === 'eraser') {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
    }
  };

  const onPointerMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !lastPoint.current) return;
    const pt = getXY(e);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = size * 4;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    }

    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      lastPoint.current = pt;
    } else if (tool === 'line' || tool === 'circle') {
      // Restore snapshot then draw preview
      const snap = undoStack.current[undoStack.current.length - 1];
      if (snap) ctx.putImageData(snap, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      if (tool === 'line') {
        ctx.moveTo(startPoint.current!.x, startPoint.current!.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      } else {
        const rx = Math.abs(pt.x - startPoint.current!.x) / 2;
        const ry = Math.abs(pt.y - startPoint.current!.y) / 2;
        const cx = (startPoint.current!.x + pt.x) / 2;
        const cy = (startPoint.current!.y + pt.y) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  };

  const onPointerUp = (_e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.closePath();
    }
    lastPoint.current = null;
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button
          onClick={onClose}
          aria-label="Close drawing"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-[#111827]" />
        </button>

        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <button onClick={undo} aria-label="Undo" className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-[#111827]">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} aria-label="Redo" className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-[#111827]">
            <Redo2 className="w-4 h-4" />
          </button>
          <button onClick={clearCanvas} aria-label="Clear canvas" className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white text-sm font-semibold rounded-2xl"
        >
          Insert
        </button>
      </header>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Drawing canvas"
          className="w-full h-full dot-grid-bg touch-none"
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />
      </div>

      {/* Bottom toolbar */}
      <div className="border-t border-gray-100 bg-white px-4 py-3">
        {/* Tools */}
        <div className="flex items-center justify-between mb-3">
          {[
            { id: 'pen', icon: <Pen className="w-4 h-4" />, label: 'Pen' },
            { id: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
            { id: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle' },
            { id: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id as Tool)}
              aria-label={t.label}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
                tool === t.id ? 'bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white' : 'bg-gray-100 text-[#6B7280]'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Size */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-gray-400 w-10">Size</span>
          <input
            type="range"
            min={1}
            max={20}
            value={size}
            onChange={e => setSize(Number(e.target.value))}
            aria-label="Brush size"
            className="flex-1 accent-[#111827]"
          />
          <div className="w-6 h-6 rounded-full bg-[#111827] flex items-center justify-center">
            <div className="bg-white rounded-full" style={{ width: Math.max(4, size), height: Math.max(4, size) }} />
          </div>
        </div>

        {/* Colors */}
        <div className="flex items-center gap-2.5">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }}
              aria-label={COLOR_NAMES[c] ?? c}
              className="w-7 h-7 rounded-full border-2 transition-all"
              style={{
                backgroundColor: c,
                borderColor: color === c ? '#7C3AED' : c === '#FFFFFF' ? '#E5E7EB' : 'transparent',
                transform: color === c ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DrawingCanvas;
