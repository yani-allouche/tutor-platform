"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Stage, Layer, Rect, Ellipse, Text, Line, Arrow, Transformer, RegularPolygon } from "react-konva";
import type Konva from "konva";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Copy,
  Download,
  Eraser,
  Highlighter,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Shapes,
  Trash2,
  Type,
  Undo2
} from "lucide-react";
import type { Board, WhiteboardObject, WhiteboardObjectType } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { createBoard, deleteBoard, duplicateBoard, moveBoard, renameBoard } from "@/app/(app)/lessons/[id]/boards/actions";

type Tool = "select" | "text" | "pencil" | "highlighter" | "shape" | "arrow" | "delete";

type LessonEditorData = {
  id: string;
  lesson_date: string;
  student_name: string | null;
};

const CANVAS_WIDTH = 1120;
const CANVAS_HEIGHT = 720;
const DRAW_COLORS = ["#172026", "#2f6f5e", "#d95f49", "#2563eb", "#7c3aed"];
const HIGHLIGHT_COLORS = ["#f5c542", "#90e0ef", "#b9fbc0", "#ffadad", "#d8b4fe"];
const SHAPE_FILLS = ["rgba(47, 111, 94, 0.08)", "rgba(37, 99, 235, 0.10)", "rgba(217, 95, 73, 0.10)", "rgba(245, 197, 66, 0.18)", "transparent"];
const SHAPES = ["rect", "ellipse", "triangle", "diamond"] as const;

export function ClassroomEditor({ lesson, boards }: { lesson: LessonEditorData; boards: Board[] }) {
  const router = useRouter();
  const sortedBoards = useMemo(() => [...boards].sort((a, b) => a.order - b.order), [boards]);
  const [activeBoardId, setActiveBoardId] = useState(sortedBoards[0]?.id ?? "");
  const [tool, setTool] = useState<Tool>("select");
  const [objects, setObjects] = useState<WhiteboardObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textColor, setTextColor] = useState("#172026");
  const [textSize, setTextSize] = useState(28);
  const [penColor, setPenColor] = useState("#172026");
  const [penWidth, setPenWidth] = useState(4);
  const [highlightColor, setHighlightColor] = useState("#f5c542");
  const [highlightWidth, setHighlightWidth] = useState(18);
  const [shapeKind, setShapeKind] = useState<(typeof SHAPES)[number]>("rect");
  const [shapeStroke, setShapeStroke] = useState("#2f6f5e");
  const [shapeFill, setShapeFill] = useState("rgba(47, 111, 94, 0.08)");
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(3);
  const [arrowColor, setArrowColor] = useState("#d95f49");
  const [arrowWidth, setArrowWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [history, setHistory] = useState<WhiteboardObject[][]>([]);
  const [future, setFuture] = useState<WhiteboardObject[][]>([]);
  const [isPending, startTransition] = useTransition();
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);

  useEffect(() => {
    if (!sortedBoards.length) return;
    if (!sortedBoards.some((board) => board.id === activeBoardId)) {
      setActiveBoardId(sortedBoards[0].id);
    }
  }, [activeBoardId, sortedBoards]);

  useEffect(() => {
    if (!activeBoardId) return;

    setSelectedId(null);
    setHistory([]);
    setFuture([]);
    setSaveStatus("saved");
    skipNextSave.current = true;

    fetch(`/api/boards/${activeBoardId}/objects`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { objects?: WhiteboardObject[] }) => {
        setObjects(payload.objects ?? []);
      })
      .catch(() => {
        setSaveStatus("error");
      });
  }, [activeBoardId]);

  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;

    const selectedNode = selectedId ? stageRef.current.findOne(`#${selectedId}`) : null;
    transformerRef.current.nodes(selectedNode ? [selectedNode] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedId, objects]);

  useEffect(() => {
    if (!activeBoardId) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      fetch(`/api/boards/${activeBoardId}/objects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objects })
      })
        .then((response) => {
          if (!response.ok) throw new Error("Save failed");
          setSaveStatus("saved");
        })
        .catch(() => {
          setSaveStatus("error");
        });
    }, 650);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [activeBoardId, objects]);

  function updateObjects(next: WhiteboardObject[], remember = true) {
    if (remember) {
      setHistory((current) => [...current.slice(-29), objects]);
      setFuture([]);
    }
    setObjects(next);
  }

  function addObject(type: WhiteboardObjectType, x: number, y: number) {
    const base = {
      id: crypto.randomUUID(),
      board_id: activeBoardId,
      type,
      x,
      y,
      rotation: 0,
      z_index: objects.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const object: WhiteboardObject =
      type === "text"
        ? {
            ...base,
            width: 260,
            height: Math.max(56, textSize + 24),
            data: { text: "Type here", fontSize: textSize, fill: textColor }
          }
        : type === "shape"
          ? {
              ...base,
              width: 180,
              height: 110,
              data: { shape: shapeKind, stroke: shapeStroke, strokeWidth: shapeStrokeWidth, fill: shapeFill }
            }
          : {
              ...base,
              width: 220,
              height: 80,
              data: { points: [0, 0, 220, 80], stroke: arrowColor, strokeWidth: arrowWidth }
            };

    updateObjects([...objects, object]);
    setSelectedId(object.id);
    setTool("select");
  }

  function getPointer() {
    const position = stageRef.current?.getPointerPosition();
    return position ? { x: position.x, y: position.y } : { x: 80, y: 80 };
  }

  function handleStageMouseDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const pointer = getPointer();
    const isStage = event.target === event.target.getStage();

    if (tool === "select") {
      if (isStage) setSelectedId(null);
      return;
    }

    if (tool === "delete") {
      const targetId = findObjectId(event.target);
      if (targetId) removeObject(targetId);
      else if (selectedId) removeObject(selectedId);
      return;
    }

    if (tool === "text") {
      addObject("text", pointer.x, pointer.y);
      return;
    }

    if (tool === "shape") {
      addObject("shape", pointer.x, pointer.y);
      return;
    }

    if (tool === "arrow") {
      addObject("arrow", pointer.x, pointer.y);
      return;
    }

    if (tool === "pencil" || tool === "highlighter") {
      const strokeObject: WhiteboardObject = {
        id: crypto.randomUUID(),
        board_id: activeBoardId,
        type: tool === "pencil" ? "pencil_stroke" : "highlighter_stroke",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        z_index: objects.length,
        data: {
          points: [pointer.x, pointer.y],
          stroke: tool === "pencil" ? penColor : highlightColor,
          strokeWidth: tool === "pencil" ? penWidth : highlightWidth,
          opacity: tool === "pencil" ? 1 : 0.38
        }
      };

      updateObjects([...objects, strokeObject]);
      setIsDrawing(true);
    }
  }

  function handleStageMouseMove() {
    if (!isDrawing) return;
    const pointer = getPointer();

    setObjects((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      if (!last || (last.type !== "pencil_stroke" && last.type !== "highlighter_stroke")) return current;
      const points = Array.isArray(last.data.points) ? (last.data.points as number[]) : [];
      next[next.length - 1] = {
        ...last,
        data: { ...last.data, points: [...points, pointer.x, pointer.y] }
      };
      return next;
    });
  }

  function handleStageMouseUp() {
    setIsDrawing(false);
  }

  function patchObject(id: string, patch: Partial<WhiteboardObject>, remember = true) {
    updateObjects(objects.map((object) => (object.id === id ? { ...object, ...patch } : object)), remember);
  }

  function removeObject(id: string) {
    if (!id) return;
    updateObjects(objects.filter((object) => object.id !== id));
    setSelectedId(null);
    setEditingTextId(null);
  }

  function clearBoard() {
    if (!objects.length) return;
    updateObjects([]);
    setSelectedId(null);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((current) => [objects, ...current]);
    setHistory((current) => current.slice(0, -1));
    setObjects(previous);
    setSelectedId(null);
    setEditingTextId(null);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setHistory((current) => [...current, objects]);
    setFuture((current) => current.slice(1));
    setObjects(next);
    setSelectedId(null);
    setEditingTextId(null);
  }

  function runBoardAction(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  function findObjectId(node: Konva.Node | null) {
    let current: Konva.Node | null = node;
    while (current) {
      const id = current.id();
      if (objects.some((object) => object.id === id)) return id;
      current = current.getParent();
    }
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">{formatDate(lesson.lesson_date)}</h1>
          <p className="text-sm text-slate-500">{lesson.student_name ?? "Unlinked lesson"}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {saveStatus === "saving" ? "Saving..." : saveStatus === "error" ? "Save failed" : "Saved"}
          </span>
          <button className="btn-secondary opacity-60" disabled title="Export will come later">
            <Download size={16} aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-8rem)] grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Boards</h2>
            <form
              action={() => {
                runBoardAction(() => createBoard(lesson.id));
              }}
            >
              <button className="rounded-md p-2 text-slate-600 hover:bg-white" aria-label="Add board" disabled={isPending}>
                <Plus size={16} aria-hidden="true" />
              </button>
            </form>
          </div>

          <div className="space-y-2">
            {sortedBoards.map((board, index) => (
              <div
                key={board.id}
                className={`rounded-md border p-2 ${
                  board.id === activeBoardId ? "border-leaf bg-white shadow-sm" : "border-slate-200 bg-white/70"
                }`}
              >
                <button className="mb-2 w-full text-left text-sm font-medium text-ink" onClick={() => setActiveBoardId(board.id)}>
                  {board.name}
                </button>
                <form
                  action={(formData) => {
                    runBoardAction(() => renameBoard(lesson.id, board.id, formData));
                  }}
                  className="mb-2"
                >
                  <input className="field py-1.5" name="name" defaultValue={board.name} aria-label="Board name" />
                </form>
                <div className="flex items-center justify-between gap-1">
                  <form
                    action={() => {
                      runBoardAction(() => moveBoard(lesson.id, board.id, "up"));
                    }}
                  >
                    <button className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" disabled={index === 0} aria-label="Move board up">
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                  </form>
                  <form
                    action={() => {
                      runBoardAction(() => moveBoard(lesson.id, board.id, "down"));
                    }}
                  >
                    <button
                      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                      disabled={index === sortedBoards.length - 1}
                      aria-label="Move board down"
                    >
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                  </form>
                  <form
                    action={() => {
                      runBoardAction(() => duplicateBoard(lesson.id, board.id));
                    }}
                  >
                    <button className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Duplicate board">
                      <Copy size={15} aria-hidden="true" />
                    </button>
                  </form>
                  <form
                    action={() => {
                      runBoardAction(() => deleteBoard(lesson.id, board.id));
                    }}
                  >
                    <button
                      className="rounded-md p-1.5 text-coral hover:bg-red-50"
                      disabled={sortedBoards.length <= 1}
                      aria-label="Delete board"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="grid min-h-[640px] grid-cols-[56px_1fr] bg-slate-100">
          <Toolbar
            tool={tool}
            setTool={(nextTool) => {
              if (nextTool === "delete" && selectedId) {
                removeObject(selectedId);
                setTool("select");
                return;
              }
              setTool(nextTool);
            }}
            undo={undo}
            redo={redo}
            clearBoard={clearBoard}
            canUndo={history.length > 0}
            canRedo={future.length > 0}
          />

          <div className="overflow-auto p-4">
            <ToolOptions
              tool={tool}
              selectedObject={objects.find((object) => object.id === selectedId)}
              textColor={textColor}
              setTextColor={(color) => {
                setTextColor(color);
                if (selectedId) {
                  const object = objects.find((item) => item.id === selectedId);
                  if (object?.type === "text") patchObject(object.id, { data: { ...object.data, fill: color } });
                }
              }}
              textSize={textSize}
              setTextSize={(size) => {
                setTextSize(size);
                if (selectedId) {
                  const object = objects.find((item) => item.id === selectedId);
                  if (object?.type === "text") patchObject(object.id, { data: { ...object.data, fontSize: size } });
                }
              }}
              penColor={penColor}
              setPenColor={setPenColor}
              penWidth={penWidth}
              setPenWidth={setPenWidth}
              highlightColor={highlightColor}
              setHighlightColor={setHighlightColor}
              highlightWidth={highlightWidth}
              setHighlightWidth={setHighlightWidth}
              shapeKind={shapeKind}
              setShapeKind={setShapeKind}
              shapeStroke={shapeStroke}
              setShapeStroke={setShapeStroke}
              shapeFill={shapeFill}
              setShapeFill={setShapeFill}
              shapeStrokeWidth={shapeStrokeWidth}
              setShapeStrokeWidth={setShapeStrokeWidth}
              arrowColor={arrowColor}
              setArrowColor={setArrowColor}
              arrowWidth={arrowWidth}
              setArrowWidth={setArrowWidth}
            />
            <div className="relative h-[720px] w-[1120px] overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
              <Stage
                ref={stageRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                onTouchStart={handleStageMouseDown}
                onTouchMove={handleStageMouseMove}
                onTouchEnd={handleStageMouseUp}
              >
                <Layer>
                  <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#ffffff" />
                  {objects.map((object) => (
                    <WhiteboardNode
                      key={object.id}
                      object={object}
                      selected={selectedId === object.id}
                      onSelect={() => {
                        if (tool !== "delete") setSelectedId(object.id);
                      }}
                      onChange={(patch) => patchObject(object.id, patch)}
                      onTextEdit={() => setEditingTextId(object.id)}
                    />
                  ))}
                  <Transformer
                    ref={transformerRef}
                    rotateEnabled
                    enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right"]}
                    boundBoxFunc={(_oldBox, newBox) => {
                      if (newBox.width < 12 || newBox.height < 12) return _oldBox;
                      return newBox;
                    }}
                  />
                </Layer>
              </Stage>
              {editingTextId ? (
                <InlineTextEditor
                  object={objects.find((object) => object.id === editingTextId)}
                  onChange={(text) => {
                    const object = objects.find((item) => item.id === editingTextId);
                    if (object) patchObject(object.id, { data: { ...object.data, text } });
                  }}
                  onDone={() => setEditingTextId(null)}
                />
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Toolbar({
  tool,
  setTool,
  undo,
  redo,
  clearBoard,
  canUndo,
  canRedo
}: {
  tool: Tool;
  setTool: (tool: Tool) => void;
  undo: () => void;
  redo: () => void;
  clearBoard: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const tools = [
    { id: "select", label: "Select", icon: MousePointer2 },
    { id: "text", label: "Text", icon: Type },
    { id: "pencil", label: "Pencil", icon: Pencil },
    { id: "highlighter", label: "Highlighter", icon: Highlighter },
    { id: "shape", label: "Shape", icon: Shapes },
    { id: "arrow", label: "Arrow", icon: ArrowLeftRight },
    { id: "delete", label: "Delete", icon: Eraser }
  ] as const;

  return (
    <div className="flex flex-col items-center gap-2 border-r border-slate-200 bg-white py-3">
      {tools.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={`rounded-md p-2 ${tool === item.id ? "bg-leaf text-white" : "text-slate-600 hover:bg-slate-100"}`}
            onClick={() => setTool(item.id)}
            aria-label={item.label}
            title={item.label}
          >
            <Icon size={19} aria-hidden="true" />
          </button>
        );
      })}
      <div className="my-1 h-px w-8 bg-slate-200" />
      <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo">
        <Undo2 size={19} aria-hidden="true" />
      </button>
      <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo">
        <Redo2 size={19} aria-hidden="true" />
      </button>
      <button className="rounded-md p-2 text-coral hover:bg-red-50" onClick={clearBoard} aria-label="Clear board" title="Clear board">
        <RotateCcw size={19} aria-hidden="true" />
      </button>
    </div>
  );
}

function ToolOptions({
  tool,
  selectedObject,
  textColor,
  setTextColor,
  textSize,
  setTextSize,
  penColor,
  setPenColor,
  penWidth,
  setPenWidth,
  highlightColor,
  setHighlightColor,
  highlightWidth,
  setHighlightWidth,
  shapeKind,
  setShapeKind,
  shapeStroke,
  setShapeStroke,
  shapeFill,
  setShapeFill,
  shapeStrokeWidth,
  setShapeStrokeWidth,
  arrowColor,
  setArrowColor,
  arrowWidth,
  setArrowWidth
}: {
  tool: Tool;
  selectedObject?: WhiteboardObject;
  textColor: string;
  setTextColor: (color: string) => void;
  textSize: number;
  setTextSize: (size: number) => void;
  penColor: string;
  setPenColor: (color: string) => void;
  penWidth: number;
  setPenWidth: (width: number) => void;
  highlightColor: string;
  setHighlightColor: (color: string) => void;
  highlightWidth: number;
  setHighlightWidth: (width: number) => void;
  shapeKind: (typeof SHAPES)[number];
  setShapeKind: (shape: (typeof SHAPES)[number]) => void;
  shapeStroke: string;
  setShapeStroke: (color: string) => void;
  shapeFill: string;
  setShapeFill: (color: string) => void;
  shapeStrokeWidth: number;
  setShapeStrokeWidth: (width: number) => void;
  arrowColor: string;
  setArrowColor: (color: string) => void;
  arrowWidth: number;
  setArrowWidth: (width: number) => void;
}) {
  const activeTool = selectedObject?.type === "text" ? "text" : tool;

  return (
    <div className="mb-3 flex min-h-12 flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
      {activeTool === "text" ? (
        <>
          <ColorSwatches colors={DRAW_COLORS} value={textColor} onChange={setTextColor} label="Text color" />
          <NumberControl label="Size" min={16} max={64} value={textSize} onChange={setTextSize} />
        </>
      ) : null}

      {tool === "pencil" ? (
        <>
          <ColorSwatches colors={DRAW_COLORS} value={penColor} onChange={setPenColor} label="Pencil color" />
          <NumberControl label="Width" min={1} max={16} value={penWidth} onChange={setPenWidth} />
        </>
      ) : null}

      {tool === "highlighter" ? (
        <>
          <ColorSwatches colors={HIGHLIGHT_COLORS} value={highlightColor} onChange={setHighlightColor} label="Highlighter color" />
          <NumberControl label="Width" min={8} max={40} value={highlightWidth} onChange={setHighlightWidth} />
        </>
      ) : null}

      {tool === "shape" ? (
        <>
          <select
            className="field w-32 py-1.5"
            value={shapeKind}
            onChange={(event) => setShapeKind(event.target.value as (typeof SHAPES)[number])}
            aria-label="Shape type"
          >
            <option value="rect">Rectangle</option>
            <option value="ellipse">Ellipse</option>
            <option value="triangle">Triangle</option>
            <option value="diamond">Diamond</option>
          </select>
          <ColorSwatches colors={DRAW_COLORS} value={shapeStroke} onChange={setShapeStroke} label="Shape outline" />
          <ColorSwatches colors={SHAPE_FILLS} value={shapeFill} onChange={setShapeFill} label="Shape fill" />
          <NumberControl label="Line" min={1} max={12} value={shapeStrokeWidth} onChange={setShapeStrokeWidth} />
        </>
      ) : null}

      {tool === "arrow" ? (
        <>
          <ColorSwatches colors={DRAW_COLORS} value={arrowColor} onChange={setArrowColor} label="Arrow color" />
          <NumberControl label="Width" min={1} max={14} value={arrowWidth} onChange={setArrowWidth} />
        </>
      ) : null}

      {tool === "select" && !selectedObject ? <span className="text-sm text-slate-500">Select or choose a tool</span> : null}
      {tool === "delete" ? <span className="text-sm text-coral">Click an object to delete it</span> : null}
    </div>
  );
}

function ColorSwatches({
  colors,
  value,
  onChange,
  label
}: {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5" aria-label={label}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={`size-7 rounded-md border ${value === color ? "border-ink ring-2 ring-leaf/30" : "border-slate-300"}`}
          style={{ backgroundColor: color === "transparent" ? "#ffffff" : color }}
          onClick={() => onChange(color)}
          title={label}
          aria-label={`${label} ${color}`}
        />
      ))}
    </div>
  );
}

function NumberControl({
  label,
  min,
  max,
  value,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      {label}
      <input
        className="h-2 w-24 accent-leaf"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="w-6 text-right text-xs tabular-nums text-slate-500">{value}</span>
    </label>
  );
}

function WhiteboardNode({
  object,
  selected,
  onSelect,
  onChange,
  onTextEdit
}: {
  object: WhiteboardObject;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<WhiteboardObject>) => void;
  onTextEdit: () => void;
}) {
  const common = {
    id: object.id,
    x: object.x,
    y: object.y,
    rotation: object.rotation,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      onChange({ x: event.target.x(), y: event.target.y() });
    },
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      const node = event.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange({
        x: node.x(),
        y: node.y(),
        width: Math.max(12, node.width() * scaleX),
        height: Math.max(12, node.height() * scaleY),
        rotation: node.rotation()
      });
    }
  };

  function centeredDragEnd(event: Konva.KonvaEventObject<DragEvent>) {
    onChange({
      x: event.target.x() - object.width / 2,
      y: event.target.y() - object.height / 2
    });
  }

  function centeredTransformEnd(event: Konva.KonvaEventObject<Event>) {
    const node = event.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const nextWidth = Math.max(12, object.width * scaleX);
    const nextHeight = Math.max(12, object.height * scaleY);
    node.scaleX(1);
    node.scaleY(1);
    onChange({
      x: node.x() - nextWidth / 2,
      y: node.y() - nextHeight / 2,
      width: nextWidth,
      height: nextHeight,
      rotation: node.rotation()
    });
  }

  if (object.type === "text") {
    return (
      <Text
        {...common}
        width={object.width}
        height={object.height}
        text={String(object.data.text ?? "")}
        fontSize={Number(object.data.fontSize ?? 28)}
        fill={String(object.data.fill ?? "#172026")}
        padding={6}
        onDblClick={onTextEdit}
        onDblTap={onTextEdit}
        stroke={selected ? "#2f6f5e" : undefined}
        strokeWidth={selected ? 1 : 0}
      />
    );
  }

  if (object.type === "shape") {
    const shape = String(object.data.shape ?? "rect");
    const shapeProps = {
      ...common,
      stroke: String(object.data.stroke ?? "#2f6f5e"),
      strokeWidth: Number(object.data.strokeWidth ?? 3),
      fill: String(object.data.fill ?? "rgba(47, 111, 94, 0.08)")
    };

    if (shape === "ellipse") {
      return (
        <Ellipse
          {...shapeProps}
          x={object.x + object.width / 2}
          y={object.y + object.height / 2}
          radiusX={object.width / 2}
          radiusY={object.height / 2}
          onDragEnd={centeredDragEnd}
          onTransformEnd={centeredTransformEnd}
        />
      );
    }

    if (shape === "triangle") {
      return (
        <RegularPolygon
          {...shapeProps}
          x={object.x + object.width / 2}
          y={object.y + object.height / 2}
          sides={3}
          radius={Math.max(object.width, object.height) / 2}
          onDragEnd={centeredDragEnd}
          onTransformEnd={centeredTransformEnd}
        />
      );
    }

    if (shape === "diamond") {
      return (
        <Line
          {...shapeProps}
          points={[object.width / 2, 0, object.width, object.height / 2, object.width / 2, object.height, 0, object.height / 2]}
          closed
          hitStrokeWidth={18}
        />
      );
    }

    return <Rect {...shapeProps} width={object.width} height={object.height} />;
  }

  if (object.type === "arrow") {
    const points = Array.isArray(object.data.points) ? (object.data.points as number[]) : [0, 0, object.width, object.height];
    return (
      <Arrow
        {...common}
        points={points}
        stroke={String(object.data.stroke ?? "#d95f49")}
        fill={String(object.data.stroke ?? "#d95f49")}
        strokeWidth={Number(object.data.strokeWidth ?? 4)}
        hitStrokeWidth={24}
      />
    );
  }

  const points = Array.isArray(object.data.points) ? (object.data.points as number[]) : [];
  return (
    <Line
      {...common}
      points={points}
      stroke={String(object.data.stroke ?? "#172026")}
      strokeWidth={Number(object.data.strokeWidth ?? 4)}
      opacity={Number(object.data.opacity ?? 1)}
      tension={0.35}
      lineCap="round"
      lineJoin="round"
      hitStrokeWidth={Math.max(24, Number(object.data.strokeWidth ?? 4) + 14)}
      globalCompositeOperation={object.type === "highlighter_stroke" ? "multiply" : "source-over"}
    />
  );
}

function InlineTextEditor({
  object,
  onChange,
  onDone
}: {
  object?: WhiteboardObject;
  onChange: (text: string) => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, [object?.id]);

  if (!object) return null;

  return (
    <textarea
      ref={ref}
      className="absolute resize-none rounded-sm border border-leaf bg-white/95 p-1.5 text-ink outline-none ring-2 ring-leaf/20"
      style={{
        left: object.x,
        top: object.y,
        width: Math.max(160, object.width),
        height: Math.max(48, object.height),
        fontSize: Number(object.data.fontSize ?? 28),
        transform: `rotate(${object.rotation}deg)`,
        transformOrigin: "top left"
      }}
      defaultValue={String(object.data.text ?? "")}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onDone}
      onKeyDown={(event) => {
        if (event.key === "Escape") onDone();
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onDone();
      }}
    />
  );
}
