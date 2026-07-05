"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Stage, Layer, Rect, Ellipse, Text, Line, Arrow, Transformer, RegularPolygon, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eraser,
  FileText,
  Highlighter,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Shapes,
  Trash2,
  Type,
  Undo2,
  X
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

type MaterialTarget = {
  id: string;
  pageNumber: number | null;
  bounds: { x: number; y: number; width: number; height: number };
};

const CANVAS_WIDTH = 1120;
const CANVAS_HEIGHT = 720;
const DRAW_COLORS = ["#172026", "#2f6f5e", "#d95f49", "#2563eb", "#7c3aed"];
const HIGHLIGHT_COLORS = ["#f5c542", "#90e0ef", "#b9fbc0", "#ffadad", "#d8b4fe"];
const SHAPE_FILLS = ["rgba(47, 111, 94, 0.08)", "rgba(37, 99, 235, 0.10)", "rgba(217, 95, 73, 0.10)", "rgba(245, 197, 66, 0.18)", "transparent"];
const SHAPES = ["rect", "ellipse", "triangle", "diamond"] as const;
const FULLSCREEN_BOUNDS = { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT };

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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingTarget, setDrawingTarget] = useState<MaterialTarget | null>(null);
  const [hoveredMaterialId, setHoveredMaterialId] = useState<string | null>(null);
  const [fullscreenMaterialId, setFullscreenMaterialId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [history, setHistory] = useState<WhiteboardObject[][]>([]);
  const [future, setFuture] = useState<WhiteboardObject[][]>([]);
  const [isPending, startTransition] = useTransition();
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);
  const rootObjects = objects.filter((object) => !object.parent_material_id);
  const materialObjects = rootObjects.filter(isMaterialObject);
  const fullscreenMaterial = fullscreenMaterialId ? materialObjects.find((object) => object.id === fullscreenMaterialId) : null;

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
        body: JSON.stringify({ objects: objects.filter(isSavableObject) })
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

  const updateObjects = useCallback((next: WhiteboardObject[], remember = true) => {
    if (remember) {
      setHistory((current) => [...current.slice(-29), objects]);
      setFuture([]);
    }
    setObjects(next);
  }, [objects]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (editingTextId || !selectedId) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;

      event.preventDefault();
      const selectedObject = objects.find((object) => object.id === selectedId);
      if (selectedObject && isMaterialObject(selectedObject)) {
        if (!window.confirm("Remove this material from the board?")) return;
        updateObjects(objects.filter((object) => object.id !== selectedId && object.parent_material_id !== selectedId));
      } else {
        updateObjects(objects.filter((object) => object.id !== selectedId));
      }
      setSelectedId(null);
      setEditingTextId(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingTextId, selectedId, objects, updateObjects]);

  async function uploadMaterial(file: File) {
    if (!activeBoardId) return;

    setUploadError(null);
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
      setUploadError("Upload a PDF, PNG, JPG, or JPEG.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File is too large. Maximum size is 50 MB.");
      return;
    }

    setIsUploading(true);
    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch(`/api/boards/${activeBoardId}/materials`, {
        method: "POST",
        body
      });
      const payload = (await response.json()) as { object?: WhiteboardObject; error?: string };
      if (!response.ok || !payload.object) throw new Error(payload.error ?? "Upload failed");
      updateObjects([...objects, payload.object]);
      setSelectedId(payload.object.id);
      setTool("select");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  function addObject(type: WhiteboardObjectType, x: number, y: number, target = getMaterialTargetAtPoint({ x, y })) {
    const relativePoint = target ? toRelativePoint(x, y, target.bounds) : { x, y };
    const baseWidth = type === "text" ? 260 : type === "shape" ? 180 : 220;
    const baseHeight = type === "text" ? Math.max(56, textSize + 24) : type === "shape" ? 110 : 80;
    const base = {
      id: crypto.randomUUID(),
      board_id: activeBoardId,
      parent_material_id: target?.id ?? null,
      page_number: target?.pageNumber ?? null,
      type,
      x: relativePoint.x,
      y: relativePoint.y,
      rotation: 0,
      z_index: objects.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const object: WhiteboardObject =
      type === "text"
        ? {
            ...base,
            width: target ? baseWidth / target.bounds.width : baseWidth,
            height: target ? baseHeight / target.bounds.height : baseHeight,
            data: { text: "", fontSize: textSize, fill: textColor }
          }
        : type === "shape"
          ? {
              ...base,
              width: target ? baseWidth / target.bounds.width : baseWidth,
              height: target ? baseHeight / target.bounds.height : baseHeight,
              data: { shape: shapeKind, stroke: shapeStroke, strokeWidth: shapeStrokeWidth, fill: shapeFill }
            }
          : {
              ...base,
              width: target ? baseWidth / target.bounds.width : baseWidth,
              height: target ? baseHeight / target.bounds.height : baseHeight,
              data: {
                points: target ? [0, 0, baseWidth / target.bounds.width, baseHeight / target.bounds.height] : [0, 0, 220, 80],
                stroke: arrowColor,
                strokeWidth: arrowWidth
              }
            };

    updateObjects([...objects, object]);
    setSelectedId(object.id);
    setTool("select");
    if (type === "text") {
      window.setTimeout(() => setEditingTextId(object.id), 0);
    }
  }

  function getPointer() {
    const position = stageRef.current?.getPointerPosition();
    return position ? { x: position.x, y: position.y } : { x: 80, y: 80 };
  }

  function handleStageMouseDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const pointer = getPointer();
    const isStage = event.target === event.target.getStage();
    const materialTarget = getMaterialTargetAtPoint(pointer);

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
      addObject("text", pointer.x, pointer.y, materialTarget);
      return;
    }

    if (tool === "shape") {
      addObject("shape", pointer.x, pointer.y, materialTarget);
      return;
    }

    if (tool === "arrow") {
      addObject("arrow", pointer.x, pointer.y, materialTarget);
      return;
    }

    if (tool === "pencil" || tool === "highlighter") {
      const startPoint = materialTarget ? toRelativePoint(pointer.x, pointer.y, materialTarget.bounds) : pointer;
      const strokeObject: WhiteboardObject = {
        id: crypto.randomUUID(),
        board_id: activeBoardId,
        parent_material_id: materialTarget?.id ?? null,
        page_number: materialTarget?.pageNumber ?? null,
        type: tool === "pencil" ? "pencil_stroke" : "highlighter_stroke",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        z_index: objects.length,
        data: {
          points: [startPoint.x, startPoint.y],
          stroke: tool === "pencil" ? penColor : highlightColor,
          strokeWidth: tool === "pencil" ? penWidth : highlightWidth,
          opacity: tool === "pencil" ? 1 : 0.38
        }
      };

      updateObjects([...objects, strokeObject]);
      setDrawingTarget(materialTarget);
      setIsDrawing(true);
    }
  }

  function handleStageMouseMove() {
    if (!isDrawing) return;
    const pointer = getPointer();
    const nextPoint = drawingTarget ? toRelativePoint(pointer.x, pointer.y, drawingTarget.bounds) : pointer;

    setObjects((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      if (!last || (last.type !== "pencil_stroke" && last.type !== "highlighter_stroke")) return current;
      const points = Array.isArray(last.data.points) ? (last.data.points as number[]) : [];
      next[next.length - 1] = {
        ...last,
        data: { ...last.data, points: [...points, nextPoint.x, nextPoint.y] }
      };
      return next;
    });
  }

  function handleStageMouseUp() {
    setIsDrawing(false);
    setDrawingTarget(null);
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

  function getMaterialTargetAtPoint(point: { x: number; y: number }): MaterialTarget | null {
    if (fullscreenMaterial) {
      return {
        id: fullscreenMaterial.id,
        pageNumber: fullscreenMaterial.type === "pdf" ? Number(fullscreenMaterial.data.page ?? 1) : null,
        bounds: FULLSCREEN_BOUNDS
      };
    }

    const materialsAtPoint = materialObjects
      .filter((object) => object.data.displayState !== "minimized")
      .filter((object) => point.x >= object.x && point.x <= object.x + object.width && point.y >= object.y && point.y <= object.y + object.height)
      .sort((a, b) => b.z_index - a.z_index);

    const material = materialsAtPoint[0];
    if (!material) return null;

    return {
      id: material.id,
      pageNumber: material.type === "pdf" ? Number(material.data.page ?? 1) : null,
      bounds: getMaterialBounds(material)
    };
  }

  function patchMaterialData(id: string, dataPatch: Record<string, unknown>) {
    const object = objects.find((item) => item.id === id);
    if (!object) return;
    patchObject(id, { data: { ...object.data, ...dataPatch } });
  }

  function removeMaterial(id: string) {
    const object = objects.find((item) => item.id === id);
    if (!object || !window.confirm("Remove this material from the board?")) return;
    updateObjects(objects.filter((item) => item.id !== id && item.parent_material_id !== id));
    setSelectedId(null);
    setFullscreenMaterialId((current) => (current === id ? null : current));
  }

  function getEditingTextObject() {
    const object = objects.find((item) => item.id === editingTextId);
    if (!object) return undefined;
    if (!object.parent_material_id) return object;

    const material = materialObjects.find((item) => item.id === object.parent_material_id);
    if (!material) return object;

    const bounds = fullscreenMaterial?.id === material.id ? FULLSCREEN_BOUNDS : getMaterialBounds(material);
    return materialAnnotationToBoard(object, bounds);
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">{formatDate(lesson.lesson_date)}</h1>
          <p className="text-sm text-slate-500">{lesson.student_name ?? "Unlinked lesson"}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="btn-secondary cursor-pointer">
            <input
              className="sr-only"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              disabled={isUploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadMaterial(file);
              }}
            />
            {isUploading ? <FileText size={16} aria-hidden="true" /> : <ImageIcon size={16} aria-hidden="true" />}
            {isUploading ? "Uploading" : "Upload"}
          </label>
          <span className="text-sm text-slate-500">
            {saveStatus === "saving" ? "Saving..." : saveStatus === "error" ? "Save failed" : "Saved"}
          </span>
          <button className="btn-secondary opacity-60" disabled title="Export will come later">
            <Download size={16} aria-hidden="true" />
            Export
          </button>
        </div>
        {uploadError ? <p className="basis-full text-sm text-coral">{uploadError}</p> : null}
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
                  {(fullscreenMaterial ? [fullscreenMaterial] : rootObjects).flatMap((object) => {
                    if (!isMaterialObject(object)) {
                      return [
                        <WhiteboardNode
                          key={object.id}
                          object={object}
                          selected={selectedId === object.id}
                          onSelect={() => {
                            if (tool !== "delete") setSelectedId(object.id);
                          }}
                          onChange={(patch) => patchObject(object.id, patch)}
                          onTextEdit={() => setEditingTextId(object.id)}
                          onPdfPageChange={() => undefined}
                        />
                      ];
                    }

                    const materialBounds = fullscreenMaterial ? FULLSCREEN_BOUNDS : getMaterialBounds(object);
                    const materialForRender = fullscreenMaterial ? { ...object, ...FULLSCREEN_BOUNDS } : object;
                    const materialPage = object.type === "pdf" ? Number(object.data.page ?? 1) : null;
                    const annotations = object.data.displayState === "minimized"
                      ? []
                      : objects
                          .filter((item) => item.parent_material_id === object.id)
                          .filter((item) => item.page_number === null || item.page_number === materialPage)
                          .map((item) => materialAnnotationToBoard(item, materialBounds));

                    return [
                      <WhiteboardNode
                        key={object.id}
                        object={materialForRender}
                        selected={selectedId === object.id}
                        onSelect={() => {
                          if (tool === "delete") return;
                          if (object.data.displayState === "minimized") {
                            patchMaterialData(object.id, { displayState: "normal" });
                            return;
                          }
                          setSelectedId(object.id);
                        }}
                        onHover={(hovered) => setHoveredMaterialId(hovered ? object.id : null)}
                        onChange={(patch) => {
                          if (!fullscreenMaterial) patchObject(object.id, patch);
                        }}
                        onTextEdit={() => undefined}
                        onPdfPageChange={(page, pageCount) => {
                          patchObject(object.id, {
                            data: {
                              ...object.data,
                              page,
                              pageCount
                            }
                          });
                        }}
                      />,
                      ...annotations.map((annotation) => (
                        <WhiteboardNode
                          key={annotation.id}
                          object={annotation}
                          selected={selectedId === annotation.id}
                          onSelect={() => {
                            if (tool !== "delete") setSelectedId(annotation.id);
                          }}
                          onChange={(patch) => patchObject(annotation.id, boardPatchToMaterialPatch(patch, materialBounds))}
                          onTextEdit={() => setEditingTextId(annotation.id)}
                          onPdfPageChange={() => undefined}
                        />
                      ))
                    ];
                  })}
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
              {!fullscreenMaterial
                ? materialObjects.map((object) => (
                    <MaterialControls
                      key={object.id}
                      object={object}
                      visible={selectedId === object.id || hoveredMaterialId === object.id}
                      onMinimize={() => patchMaterialData(object.id, { displayState: "minimized" })}
                      onFullscreen={() => {
                        patchMaterialData(object.id, { displayState: "normal" });
                        setFullscreenMaterialId(object.id);
                        setSelectedId(object.id);
                      }}
                      onClose={() => removeMaterial(object.id)}
                    />
                  ))
                : (
                    <MaterialControls
                      object={{ ...fullscreenMaterial, ...FULLSCREEN_BOUNDS }}
                      visible
                      fullscreen
                      onMinimize={() => {
                        setFullscreenMaterialId(null);
                        patchMaterialData(fullscreenMaterial.id, { displayState: "minimized" });
                      }}
                      onFullscreen={() => setFullscreenMaterialId(null)}
                      onClose={() => removeMaterial(fullscreenMaterial.id)}
                    />
                  )}
              {editingTextId ? (
                <InlineTextEditor
                  object={getEditingTextObject()}
                  onChange={(text) => {
                    const object = objects.find((item) => item.id === editingTextId);
                    if (object) patchObject(object.id, { data: { ...object.data, text } }, false);
                  }}
                  onDone={(text) => {
                    const object = objects.find((item) => item.id === editingTextId);
                    if (!object) {
                      setEditingTextId(null);
                      return;
                    }

                    if (!text.trim()) {
                      removeObject(object.id);
                      return;
                    }

                    patchObject(object.id, { data: { ...object.data, text } });
                    setEditingTextId(null);
                    setSelectedId(null);
                  }}
                />
              ) : null}
              {selectedId ? (
                <PdfControls
                  object={objects.find((object) => object.id === selectedId)}
                  bounds={fullscreenMaterial?.id === selectedId ? FULLSCREEN_BOUNDS : undefined}
                  onPageChange={(page) => {
                    const object = objects.find((item) => item.id === selectedId);
                    if (object?.type === "pdf") {
                      patchObject(object.id, { data: { ...object.data, page } });
                    }
                  }}
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

function MaterialControls({
  object,
  visible,
  fullscreen = false,
  onMinimize,
  onFullscreen,
  onClose
}: {
  object: WhiteboardObject;
  visible: boolean;
  fullscreen?: boolean;
  onMinimize: () => void;
  onFullscreen: () => void;
  onClose: () => void;
}) {
  if (!visible || object.data.displayState === "minimized") return null;

  return (
    <div
      className="absolute flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 p-1 shadow-sm"
      style={{
        left: Math.max(8, object.x + object.width - 100),
        top: Math.max(8, object.y + 8)
      }}
    >
      <button className="rounded p-1 text-slate-600 hover:bg-slate-100" onClick={onMinimize} aria-label="Minimize material" title="Minimize">
        <Minimize2 size={15} aria-hidden="true" />
      </button>
      <button className="rounded p-1 text-slate-600 hover:bg-slate-100" onClick={onFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
        <Maximize2 size={15} aria-hidden="true" />
      </button>
      <button className="rounded p-1 text-coral hover:bg-red-50" onClick={onClose} aria-label="Remove material" title="Remove">
        <X size={15} aria-hidden="true" />
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
  onTextEdit,
  onPdfPageChange,
  onHover
}: {
  object: WhiteboardObject;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<WhiteboardObject>) => void;
  onTextEdit: () => void;
  onPdfPageChange: (page: number, pageCount?: number) => void;
  onHover?: (hovered: boolean) => void;
}) {
  const common = {
    id: object.id,
    x: object.x,
    y: object.y,
    rotation: object.rotation,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onMouseEnter: () => onHover?.(true),
    onMouseLeave: () => onHover?.(false),
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

  if (object.type === "image") {
    if (object.data.displayState === "minimized") {
      return <MinimizedMaterialNode common={common} object={object} label={`Image — ${String(object.data.filename ?? "Image")}`} />;
    }

    return (
      <MaterialImageNode
        common={common}
        object={object}
        selected={selected}
        url={String(object.data.url ?? "")}
      />
    );
  }

  if (object.type === "pdf") {
    if (object.data.displayState === "minimized") {
      return <MinimizedMaterialNode common={common} object={object} label={`PDF — ${String(object.data.filename ?? "PDF")}`} />;
    }

    return (
      <PdfNode
        common={common}
        object={object}
        selected={selected}
        url={String(object.data.url ?? "")}
        page={Number(object.data.page ?? 1)}
        onPageReady={onPdfPageChange}
      />
    );
  }

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

function MaterialImageNode({
  common,
  object,
  selected,
  url
}: {
  common: Record<string, unknown>;
  object: WhiteboardObject;
  selected: boolean;
  url: string;
}) {
  const image = useCanvasImage(url);

  return (
    <>
      <KonvaImage
        {...common}
        image={image ?? undefined}
        width={object.width}
        height={object.height}
        stroke={selected ? "#2f6f5e" : undefined}
        strokeWidth={selected ? 2 : 0}
      />
      {!image ? (
        <Rect
          {...common}
          width={object.width}
          height={object.height}
          fill="#f8fafc"
          stroke="#cbd5e1"
          dash={[8, 6]}
        />
      ) : null}
    </>
  );
}

function MinimizedMaterialNode({
  common,
  object,
  label
}: {
  common: Record<string, unknown>;
  object: WhiteboardObject;
  label: string;
}) {
  return (
    <>
      <Rect {...common} width={260} height={52} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1.5} cornerRadius={6} />
      <Text
        {...common}
        x={object.x + 12}
        y={object.y + 16}
        width={236}
        height={20}
        text={label}
        fill="#172026"
        fontSize={14}
        ellipsis
      />
    </>
  );
}

function PdfNode({
  common,
  object,
  selected,
  url,
  page,
  onPageReady
}: {
  common: Record<string, unknown>;
  object: WhiteboardObject;
  selected: boolean;
  url: string;
  page: number;
  onPageReady: (page: number, pageCount?: number) => void;
}) {
  const { image, pageCount } = usePdfPageImage(url, page);

  useEffect(() => {
    if (pageCount && pageCount !== Number(object.data.pageCount ?? 0)) {
      onPageReady(page, pageCount);
    }
  }, [object.data.pageCount, onPageReady, page, pageCount]);

  return (
    <>
      <KonvaImage
        {...common}
        image={image ?? undefined}
        width={object.width}
        height={object.height}
        stroke={selected ? "#2f6f5e" : "#d5dce3"}
        strokeWidth={selected ? 2 : 1}
      />
      {!image ? (
        <Text
          {...common}
          width={object.width}
          height={object.height}
          text="Loading PDF..."
          align="center"
          verticalAlign="middle"
          fill="#64748b"
          fontSize={18}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
      ) : null}
    </>
  );
}

function PdfControls({
  object,
  bounds,
  onPageChange
}: {
  object?: WhiteboardObject;
  bounds?: { x: number; y: number; width: number; height: number };
  onPageChange: (page: number) => void;
}) {
  if (object?.type !== "pdf") return null;

  const page = Number(object.data.page ?? 1);
  const pageCount = Number(object.data.pageCount ?? 1);
  const controlBounds = bounds ?? getMaterialBounds(object);

  return (
    <div
      className="absolute flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm shadow-sm"
      style={{
        left: Math.max(8, controlBounds.x),
        top: Math.max(8, controlBounds.y + 8)
      }}
    >
      <button
        className="rounded-md p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous PDF page"
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <span className="min-w-16 text-center text-slate-600">
        {page} / {pageCount || "?"}
      </span>
      <button
        className="rounded-md p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        disabled={pageCount > 0 && page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next PDF page"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function useCanvasImage(url: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }

    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => setImage(nextImage);
    nextImage.onerror = () => setImage(null);
    nextImage.src = url;
  }, [url]);

  return image;
}

function usePdfPageImage(url: string, page: number) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPdfPage() {
      if (!url) {
        setImage(null);
        return;
      }

      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      const pdf = await pdfjs.getDocument({ url }).promise;
      const safePage = Math.min(Math.max(page, 1), pdf.numPages);
      const pdfPage = await pdf.getPage(safePage);
      const viewport = pdfPage.getViewport({ scale: 1.4 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;

      if (cancelled) return;
      setPageCount(pdf.numPages);

      const nextImage = new window.Image();
      nextImage.onload = () => {
        if (!cancelled) setImage(nextImage);
      };
      nextImage.src = canvas.toDataURL("image/png");
    }

    void renderPdfPage().catch(() => {
      if (!cancelled) setImage(null);
    });

    return () => {
      cancelled = true;
    };
  }, [page, url]);

  return { image, pageCount };
}

function InlineTextEditor({
  object,
  onChange,
  onDone
}: {
  object?: WhiteboardObject;
  onChange: (text: string) => void;
  onDone: (text: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, [object?.id]);

  if (!object) return null;

  function finishEditing() {
    onDone(ref.current?.value ?? "");
  }

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
      onBlur={finishEditing}
      onKeyDown={(event) => {
        if (event.key === "Escape") finishEditing();
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") finishEditing();
      }}
    />
  );
}

function isSavableObject(object: WhiteboardObject) {
  if (object.type !== "text") return true;
  return String(object.data.text ?? "").trim().length > 0;
}

function isMaterialObject(object: WhiteboardObject) {
  return object.type === "image" || object.type === "pdf";
}

function getMaterialBounds(material: WhiteboardObject) {
  return {
    x: material.x,
    y: material.y,
    width: material.width,
    height: material.height
  };
}

function toRelativePoint(x: number, y: number, bounds: { x: number; y: number; width: number; height: number }) {
  return {
    x: (x - bounds.x) / bounds.width,
    y: (y - bounds.y) / bounds.height
  };
}

function materialAnnotationToBoard(object: WhiteboardObject, bounds: { x: number; y: number; width: number; height: number }): WhiteboardObject {
  const data = { ...object.data };

  if (object.type === "pencil_stroke" || object.type === "highlighter_stroke") {
    if (Array.isArray(data.points)) {
      data.points = (data.points as number[]).map((point, index) => (index % 2 === 0 ? bounds.x + point * bounds.width : bounds.y + point * bounds.height));
    }

    return {
      ...object,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      data
    };
  }

  if (object.type === "arrow" && Array.isArray(data.points)) {
    data.points = (data.points as number[]).map((point, index) => (index % 2 === 0 ? point * bounds.width : point * bounds.height));
  }

  return {
    ...object,
    x: bounds.x + object.x * bounds.width,
    y: bounds.y + object.y * bounds.height,
    width: object.width * bounds.width,
    height: object.height * bounds.height,
    data
  };
}

function boardPatchToMaterialPatch(patch: Partial<WhiteboardObject>, bounds: { x: number; y: number; width: number; height: number }): Partial<WhiteboardObject> {
  const next: Partial<WhiteboardObject> = { ...patch };
  if (typeof patch.x === "number") next.x = (patch.x - bounds.x) / bounds.width;
  if (typeof patch.y === "number") next.y = (patch.y - bounds.y) / bounds.height;
  if (typeof patch.width === "number") next.width = patch.width / bounds.width;
  if (typeof patch.height === "number") next.height = patch.height / bounds.height;

  if (patch.data && Array.isArray(patch.data.points)) {
    next.data = {
      ...patch.data,
      points: (patch.data.points as number[]).map((point, index) => (index % 2 === 0 ? (point - bounds.x) / bounds.width : (point - bounds.y) / bounds.height))
    };
  }

  return next;
}
