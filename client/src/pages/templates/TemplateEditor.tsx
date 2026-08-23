import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bold,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Type,
  Image as ImageIcon,
  Layers as LayersIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import {
  type InvoiceTemplate,
  type TemplateElement,
  type BindingKey,
  BINDING_LABELS,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  newElementId,
  defaultElements,
} from '../../lib/templateTypes';

const SCALE = 0.62;

type DragMode = { kind: 'move' | 'resize' | 'rotate'; id: string; startX: number; startY: number; orig: TemplateElement } | null;

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [elements, setElements] = useState<TemplateElement[]>([]);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<TemplateElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showLayers, setShowLayers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dragRef = useRef<DragMode>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<InvoiceTemplate>(`/api/templates/${id}`).then((tpl) => {
      setName(tpl.name);
      const els = tpl.elements.length > 0 ? tpl.elements : defaultElements();
      setElements(els);
      setBackgroundUrl(tpl.background_url);
      setHistory([els]);
      setHistoryIndex(0);
    });
  }, [id]);

  const selected = elements.find((e) => e.id === selectedId) || null;

  const usedBindings = useMemo(
    () => new Set(elements.filter((e) => e.type === 'binding').map((e) => e.binding)),
    [elements]
  );
  const availableBindings = (Object.keys(BINDING_LABELS) as BindingKey[]).filter((b) => !usedBindings.has(b));

  function pushHistory(next: TemplateElement[]) {
    const trimmed = history.slice(0, historyIndex + 1);
    const newHistory = [...trimmed, next].slice(-20); // cap at 20 steps
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }

  function updateElements(next: TemplateElement[], commit = true) {
    setElements(next);
    if (commit) pushHistory(next);
  }

  function undo() {
    if (historyIndex <= 0) return;
    const idx = historyIndex - 1;
    setHistoryIndex(idx);
    setElements(history[idx]);
  }
  function redo() {
    if (historyIndex >= history.length - 1) return;
    const idx = historyIndex + 1;
    setHistoryIndex(idx);
    setElements(history[idx]);
  }

  function updateSelected(patch: Partial<TemplateElement>, commit = true) {
    if (!selectedId) return;
    const next = elements.map((e) => (e.id === selectedId ? { ...e, ...patch } : e));
    updateElements(next, commit);
  }

  function addTextElement() {
    const el: TemplateElement = {
      id: newElementId(),
      type: 'custom_text',
      text: 'New Text',
      label: 'Custom Text',
      x: 300,
      y: 500,
      width: 200,
      height: 30,
      rotation: 0,
      zIndex: elements.length + 1,
      fontSize: 14,
      fontWeight: 'normal',
      lineHeight: 1.4,
      color: '#1a1a1a',
      align: 'left',
    };
    updateElements([...elements, el]);
    setSelectedId(el.id);
  }

  function addBindingElement(binding: BindingKey) {
    const el: TemplateElement = {
      id: newElementId(),
      type: 'binding',
      binding,
      label: BINDING_LABELS[binding],
      x: 300,
      y: 500,
      width: 250,
      height: 60,
      rotation: 0,
      zIndex: elements.length + 1,
      fontSize: 13,
      fontWeight: 'normal',
      lineHeight: 1.4,
      color: '#1a1a1a',
      align: 'left',
    };
    updateElements([...elements, el]);
    setSelectedId(el.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    updateElements(elements.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selected) return;
    const copy = { ...selected, id: newElementId(), x: selected.x + 20, y: selected.y + 20 };
    updateElements([...elements, copy]);
    setSelectedId(copy.id);
  }

  function bringForward() {
    if (!selected) return;
    updateSelected({ zIndex: Math.max(...elements.map((e) => e.zIndex)) + 1 });
  }
  function sendBackward() {
    if (!selected) return;
    updateSelected({ zIndex: Math.min(...elements.map((e) => e.zIndex)) - 1 });
  }

  // ---- Drag / resize / rotate ----
  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !canvasRef.current) return;
      const dx = (e.clientX - drag.startX) / SCALE;
      const dy = (e.clientY - drag.startY) / SCALE;

      if (drag.kind === 'move') {
        setElements((prev) =>
          prev.map((el) =>
            el.id === drag.id
              ? { ...el, x: Math.round(drag.orig.x + dx), y: Math.round(drag.orig.y + dy) }
              : el
          )
        );
      } else if (drag.kind === 'resize') {
        setElements((prev) =>
          prev.map((el) =>
            el.id === drag.id
              ? {
                  ...el,
                  width: Math.max(30, Math.round(drag.orig.width + dx)),
                  height: Math.max(20, Math.round(drag.orig.height + dy)),
                }
              : el
          )
        );
      } else if (drag.kind === 'rotate') {
        const rect = canvasRef.current.getBoundingClientRect();
        const elCenterX = rect.left + (drag.orig.x + drag.orig.width / 2) * SCALE;
        const elCenterY = rect.top + (drag.orig.y + drag.orig.height / 2) * SCALE;
        const angle = (Math.atan2(e.clientY - elCenterY, e.clientX - elCenterX) * 180) / Math.PI + 90;
        setElements((prev) =>
          prev.map((el) => (el.id === drag.id ? { ...el, rotation: Math.round(angle) } : el))
        );
      }
    },
    []
  );

  const onPointerUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      setElements((current) => {
        pushHistory(current);
        return current;
      });
    }
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPointerMove]);

  function startDrag(kind: 'move' | 'resize' | 'rotate', el: TemplateElement, e: React.PointerEvent) {
    if (el.locked) return;
    e.stopPropagation();
    setSelectedId(el.id);
    dragRef.current = { kind, id: el.id, startX: e.clientX, startY: e.clientY, orig: el };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (e.key === 'Delete' && selectedId) {
        deleteSelected();
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, historyIndex, history]);

  async function handleUploadBackground(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/uploads/background', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok) setBackgroundUrl(data.url);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/api/templates/${id}`, { name, elements, backgroundUrl });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    await handleSave();
    window.open(`/api/templates/${id}/preview`, '_blank');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={() => navigate('/templates')} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={historyIndex <= 0} className="rounded-lg border border-border p-2 text-text-muted disabled:opacity-30" aria-label="Undo">
            <Undo2 size={15} />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="rounded-lg border border-border p-2 text-text-muted disabled:opacity-30" aria-label="Redo">
            <Redo2 size={15} />
          </button>
          <button onClick={() => setShowLayers((v) => !v)} className="rounded-lg border border-border p-2 text-text-muted" aria-label="Layers">
            <LayersIcon size={15} />
          </button>
          <button onClick={handlePreview} className="rounded-lg border border-border px-3 py-2 text-xs">
            Preview
          </button>
          <button onClick={handleSave} disabled={saving} className="rounded-lg gradient-brand px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      <input
        className="w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Template name"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={addTextElement} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs">
          <Type size={13} /> Add Text
        </button>
        <label className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs cursor-pointer">
          <ImageIcon size={13} /> Upload Background
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUploadBackground(e.target.files[0])}
          />
        </label>
        {availableBindings.length > 0 && (
          <select
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs outline-none"
            value=""
            onChange={(e) => e.target.value && addBindingElement(e.target.value as BindingKey)}
          >
            <option value="">+ Add field…</option>
            {availableBindings.map((b) => (
              <option key={b} value={b}>
                {BINDING_LABELS[b]}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-4 items-start flex-wrap">
        {/* Canvas */}
        <div
          ref={canvasRef}
          onPointerDown={() => setSelectedId(null)}
          className="relative bg-white shrink-0 shadow-2xl"
          style={{ width: PAGE_WIDTH * SCALE, height: PAGE_HEIGHT * SCALE }}
        >
          {backgroundUrl && (
            <img src={backgroundUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90 pointer-events-none" />
          )}
          {elements
            .filter((el) => !el.hidden)
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((el) => (
              <div
                key={el.id}
                onPointerDown={(e) => startDrag('move', el, e)}
                className={`absolute select-none ${el.locked ? 'cursor-not-allowed' : 'cursor-move'} ${
                  selectedId === el.id ? 'ring-2 ring-brand' : 'hover:ring-1 hover:ring-brand/40'
                }`}
                style={{
                  left: el.x * SCALE,
                  top: el.y * SCALE,
                  width: el.width * SCALE,
                  height: el.height * SCALE,
                  transform: `rotate(${el.rotation}deg)`,
                  fontSize: el.fontSize * SCALE,
                  fontWeight: el.fontWeight,
                  textAlign: el.align,
                  overflow: 'hidden',
                }}
              >
                <div style={{ color: el.color, fontWeight: el.fontWeight, textAlign: el.align, fontSize: 'inherit', lineHeight: el.lineHeight }}>
                  {el.type === 'custom_text' ? el.text : `[${el.label}]`}
                </div>

                {selectedId === el.id && !el.locked && (
                  <>
                    <div
                      onPointerDown={(e) => startDrag('resize', el, e)}
                      className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full bg-brand cursor-nwse-resize"
                    />
                    <div
                      onPointerDown={(e) => startDrag('rotate', el, e)}
                      className="absolute -top-5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-brand cursor-grab"
                    />
                  </>
                )}
              </div>
            ))}
        </div>

        {/* Right panel: properties or layers */}
        <div className="flex-1 min-w-[240px] space-y-4">
          {showLayers ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium mb-3">Layers</p>
              <div className="space-y-1">
                {elements
                  .slice()
                  .sort((a, b) => b.zIndex - a.zIndex)
                  .map((el) => (
                    <div
                      key={el.id}
                      onClick={() => setSelectedId(el.id)}
                      className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs cursor-pointer ${
                        selectedId === el.id ? 'bg-brand/15 text-brand' : 'hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{el.type === 'custom_text' ? el.text || 'Text' : el.label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateElements(elements.map((x) => (x.id === el.id ? { ...x, hidden: !x.hidden } : x)));
                          }}
                        >
                          {el.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateElements(elements.map((x) => (x.id === el.id ? { ...x, locked: !x.locked } : x)));
                          }}
                        >
                          {el.locked ? <Lock size={13} /> : <Unlock size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : selected ? (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-medium">{selected.type === 'custom_text' ? 'Text Element' : selected.label}</p>

              {selected.type === 'custom_text' && (
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Text</label>
                  <input
                    className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs outline-none focus:border-brand"
                    value={selected.text || ''}
                    onChange={(e) => updateSelected({ text: e.target.value }, false)}
                    onBlur={() => pushHistory(elements)}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">X</label>
                  <input type="number" className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs" value={selected.x} onChange={(e) => updateSelected({ x: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Y</label>
                  <input type="number" className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs" value={selected.y} onChange={(e) => updateSelected({ y: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Width</label>
                  <input type="number" className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs" value={selected.width} onChange={(e) => updateSelected({ width: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Height</label>
                  <input type="number" className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs" value={selected.height} onChange={(e) => updateSelected({ height: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Rotation</label>
                  <input type="number" className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs" value={selected.rotation} onChange={(e) => updateSelected({ rotation: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Font Size</label>
                  <input type="number" className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs" value={selected.fontSize} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Line Spacing</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.8"
                    max="3"
                    className="w-full rounded-lg border border-border bg-[#171921] px-2 py-1.5 text-xs"
                    value={selected.lineHeight ?? 1.4}
                    onChange={(e) => updateSelected({ lineHeight: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateSelected({ fontWeight: selected.fontWeight === 'bold' ? 'normal' : 'bold' })}
                  className={`rounded-lg border p-2 ${selected.fontWeight === 'bold' ? 'border-brand text-brand' : 'border-border text-text-muted'}`}
                >
                  <Bold size={14} />
                </button>
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => updateSelected({ align: a })}
                    className={`rounded-lg border p-2 ${selected.align === a ? 'border-brand text-brand' : 'border-border text-text-muted'}`}
                  >
                    {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                  </button>
                ))}
                <input
                  type="color"
                  value={selected.color}
                  onChange={(e) => updateSelected({ color: e.target.value })}
                  className="h-9 w-9 rounded-lg border border-border bg-transparent cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button onClick={bringForward} aria-label="Bring forward" className="rounded-lg border border-border p-2 text-text-muted">
                  <ChevronUp size={14} />
                </button>
                <button onClick={sendBackward} aria-label="Send backward" className="rounded-lg border border-border p-2 text-text-muted">
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={() => updateSelected({ locked: !selected.locked })}
                  aria-label="Lock"
                  className="rounded-lg border border-border p-2 text-text-muted"
                >
                  {selected.locked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
                <button onClick={duplicateSelected} aria-label="Duplicate" className="rounded-lg border border-border p-2 text-text-muted">
                  <Copy size={14} />
                </button>
                <button onClick={deleteSelected} aria-label="Delete" className="rounded-lg border border-danger/40 p-2 text-danger ml-auto">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-text-muted">
              Select an element to edit its properties, or add a new one above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
