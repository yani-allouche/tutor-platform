"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Stage, Layer, Rect, Ellipse, Text, Line, Arrow, Transformer, RegularPolygon, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FileText,
  Hand,
  Highlighter,
  Home,
  Image as ImageIcon,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  RotateCcw,
  Shapes,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import type { Board, LessonSummary, WhiteboardObject, WhiteboardObjectType } from "@/lib/types";

type Tool = "select" | "hand" | "text" | "pencil" | "highlighter" | "shape" | "arrow" | "delete";

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

const CANVAS_WIDTH = 10000;
const CANVAS_HEIGHT = 10000;
const DEFAULT_VIEWPORT = { width: 1200, height: 760 };
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const DRAW_COLORS = ["#172026", "#2f6f5e", "#d95f49", "#2563eb", "#7c3aed"];
const HIGHLIGHT_COLORS = ["#f5c542", "#90e0ef", "#b9fbc0", "#ffadad", "#d8b4fe"];
const SHAPE_FILLS = ["rgba(47, 111, 94, 0.08)", "rgba(37, 99, 235, 0.10)", "rgba(217, 95, 73, 0.10)", "rgba(245, 197, 66, 0.18)", "transparent"];
const SHAPES = ["rect", "ellipse", "triangle", "diamond"] as const;
export function ClassroomEditor({
  lesson,
  boards,
  lessonOptions,
  isGuestMode = false
}: {
  lesson: LessonEditorData;
  boards: Board[];
  lessonOptions: LessonSummary[];
  isGuestMode?: boolean;
}) {
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
  const [controlsHoveredMaterialId, setControlsHoveredMaterialId] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState(DEFAULT_VIEWPORT);
  const [viewportScale, setViewportScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | "guest">("saved");
  const [history, setHistory] = useState<WhiteboardObject[][]>([]);
  const [future, setFuture] = useState<WhiteboardObject[][]>([]);
  const stageRef = useRef<Konva.Stage>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const materialHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);
  const rootObjects = objects.filter((object) => !object.parent_material_id);
  const materialObjects = rootObjects.filter(isMaterialObject);
  const minimizedMaterials = materialObjects.filter((object) => object.data.displayState === "minimized");

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
    setSaveStatus(isGuestMode ? "guest" : "saved");
    skipNextSave.current = true;

    if (isGuestMode) {
      setObjects([]);
      return;
    }

    fetch(`/api/boards/${activeBoardId}/objects`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { objects?: WhiteboardObject[] }) => {
        setObjects(payload.objects ?? []);
      })
      .catch(() => {
        setSaveStatus("error");
      });
  }, [activeBoardId, isGuestMode]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    function measure() {
      const rect = node?.getBoundingClientRect();
      if (!rect) return;
      setViewportSize({
        width: Math.max(360, Math.floor(rect.width)),
        height: Math.max(420, Math.floor(rect.height))
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;

    const selectedObject = selectedId ? objects.find((object) => object.id === selectedId) : null;
    const canTransformSelected = selectedObject ? !isMaterialObject(selectedObject) : false;
    const selectedNode = tool === "select" && selectedId && canTransformSelected ? stageRef.current.findOne(`#${selectedId}`) : null;
    transformerRef.current.nodes(selectedNode ? [selectedNode] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedId, objects, tool]);

  useEffect(() => {
    if (!activeBoardId) return;
    if (isGuestMode) {
      setSaveStatus("guest");
      return;
    }

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
  }, [activeBoardId, objects, isGuestMode]);

  const updateObjects = useCallback((next: WhiteboardObject[], remember = true) => {
    if (remember) {
      setHistory((current) => [...current.slice(-29), objects]);
      setFuture([]);
    }
    setObjects(next);
  }, [objects]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === "Space" && !editingTextId) {
        event.preventDefault();
        setSpacePressed(true);
        return;
      }

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

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") setSpacePressed(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
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

    if (isGuestMode) {
      const objectUrl = URL.createObjectURL(file);
      const timestamp = new Date().toISOString();
      const materialObject: WhiteboardObject = {
        id: crypto.randomUUID(),
        board_id: activeBoardId,
        parent_material_id: null,
        page_number: null,
        type: file.type === "application/pdf" ? "pdf" : "image",
        x: 0,
        y: 0,
        width: Math.max(360, viewportSize.width),
        height: Math.max(320, viewportSize.height),
        rotation: 0,
        z_index: objects.length,
        data: {
          url: objectUrl,
          filename: file.name,
          fileType: file.type,
          fileSize: file.size,
          displayMode: "fullBoard",
          displayState: "normal",
          page: 1
        },
        created_at: timestamp,
        updated_at: timestamp
      };
      const fittedObject = fitMaterialToBoard(materialObject);
      updateObjects([...objects, fittedObject]);
      setSelectedId(materialObject.id);
      setTool("select");
      setViewportScale(1);
      setStagePosition({ x: 0, y: 0 });
      setSaveStatus("guest");
      setIsUploading(false);
      return;
    }

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch(`/api/boards/${activeBoardId}/materials`, {
        method: "POST",
        body
      });
      const payload = (await response.json()) as { object?: WhiteboardObject; error?: string };
      if (!response.ok || !payload.object) throw new Error(payload.error ?? "Upload failed");
      const fittedObject = fitMaterialToBoard(payload.object);
      updateObjects([...objects, fittedObject]);
      setSelectedId(payload.object.id);
      setTool("select");
      setViewportScale(1);
      setStagePosition({ x: 0, y: 0 });
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
    return position ? viewportToCanvas(position) : getViewportCenter();
  }

  function viewportToCanvas(point: { x: number; y: number }) {
    return {
      x: (point.x - stagePosition.x) / viewportScale,
      y: (point.y - stagePosition.y) / viewportScale
    };
  }

  function canvasToViewport(point: { x: number; y: number }) {
    return {
      x: point.x * viewportScale + stagePosition.x,
      y: point.y * viewportScale + stagePosition.y
    };
  }

  function objectToViewport(object: WhiteboardObject): WhiteboardObject {
    const position = canvasToViewport({ x: object.x, y: object.y });
    return {
      ...object,
      x: position.x,
      y: position.y,
      width: object.width * viewportScale,
      height: object.height * viewportScale
    };
  }

  function fitMaterialToBoard(object: WhiteboardObject, sourceSize?: { width: number; height: number }): WhiteboardObject {
    const width = Math.max(360, viewportSize.width);
    const fallbackHeight = Math.max(320, viewportSize.height);
    const height =
      sourceSize && sourceSize.width > 0 && sourceSize.height > 0
        ? Math.max(fallbackHeight, width * (sourceSize.height / sourceSize.width))
        : fallbackHeight;

    return {
      ...object,
      x: 0,
      y: 0,
      width,
      height,
      data: {
        ...object.data,
        displayMode: "fullBoard",
        displayState: "normal"
      }
    };
  }

  function viewportRectFromCanvas(bounds: { x: number; y: number; width: number; height: number }) {
    const position = canvasToViewport({ x: bounds.x, y: bounds.y });
    return {
      x: position.x,
      y: position.y,
      width: bounds.width * viewportScale,
      height: bounds.height * viewportScale
    };
  }

  function getViewportCenter() {
    return viewportToCanvas({ x: viewportSize.width / 2, y: viewportSize.height / 2 });
  }

  function clampScale(scale: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
  }

  function zoomAt(nextScale: number, center = { x: viewportSize.width / 2, y: viewportSize.height / 2 }) {
    const clampedScale = clampScale(nextScale);
    const canvasPoint = viewportToCanvas(center);
    setViewportScale(clampedScale);
    setStagePosition({
      x: center.x - canvasPoint.x * clampedScale,
      y: center.y - canvasPoint.y * clampedScale
    });
  }

  function resetViewport() {
    setViewportScale(1);
    setStagePosition({ x: 0, y: 0 });
  }

  function handleWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();
    const pointer = stageRef.current?.getPointerPosition() ?? { x: viewportSize.width / 2, y: viewportSize.height / 2 };

    if (event.evt.ctrlKey || event.evt.metaKey) {
      const direction = event.evt.deltaY > 0 ? -1 : 1;
      zoomAt(viewportScale * (direction > 0 ? 1.08 : 0.92), pointer);
      return;
    }

    setStagePosition((current) => ({
      x: current.x - event.evt.deltaX,
      y: current.y - event.evt.deltaY
    }));
  }

  function handleStageMouseDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (tool === "hand" || spacePressed) {
      setSelectedId(null);
      return;
    }

    const pointer = getPointer();
    const isStage = event.target === event.target.getStage() || event.target.name() === "canvas-background";
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

  async function saveNow(nextObjects = objects) {
    if (!activeBoardId) return true;
    if (isGuestMode) {
      setSaveStatus("guest");
      return true;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");

    try {
      const response = await fetch(`/api/boards/${activeBoardId}/objects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objects: nextObjects.filter(isSavableObject) })
      });
      if (!response.ok) throw new Error("Save failed");
      setSaveStatus("saved");
      return true;
    } catch {
      setSaveStatus("error");
      return false;
    }
  }

  async function openLesson(lessonId: string) {
    if (lessonId === lesson.id) return;
    if (isGuestMode) {
      router.push(`/lessons/${lessonId}`);
      return;
    }

    const saved = await saveNow();
    if (!saved && !window.confirm("The whiteboard could not save. Leave anyway?")) return;
    router.push(`/lessons/${lessonId}`);
  }

  async function closeWhiteboard() {
    if (isGuestMode) {
      router.push("/lessons");
      return;
    }

    const saved = await saveNow();
    if (!saved && !window.confirm("The whiteboard could not save. Leave anyway?")) return;
    router.push("/lessons");
  }

  function exportBoardImage() {
    const stage = stageRef.current;
    if (!stage) return;

    const bounds = getExportBounds(objects, materialObjects);
    const previous = {
      x: stage.x(),
      y: stage.y(),
      scaleX: stage.scaleX(),
      scaleY: stage.scaleY()
    };

    stage.position({ x: 0, y: 0 });
    stage.scale({ x: 1, y: 1 });
    stage.batchDraw();

    const url = stage.toDataURL({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      pixelRatio: 2
    });

    stage.position({ x: previous.x, y: previous.y });
    stage.scale({ x: previous.scaleX, y: previous.scaleY });
    stage.batchDraw();

    const link = document.createElement("a");
    link.href = url;
    link.download = `whiteboard-${lesson.lesson_date}.png`;
    link.click();
  }

  function removeObject(id: string) {
    if (!id) return;
    updateObjects(objects.filter((item) => item.id !== id && item.parent_material_id !== id));
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

  function minimizeMaterial(id: string) {
    patchMaterialData(id, { displayState: "minimized" });
    setSelectedId(null);
    setHoveredMaterialId(null);
    setControlsHoveredMaterialId(null);
  }

  function removeMaterial(id: string) {
    const object = objects.find((item) => item.id === id);
    if (!object || !window.confirm("Remove this material from the board?")) return;
    updateObjects(objects.filter((item) => item.id !== id && item.parent_material_id !== id));
    setSelectedId(null);
  }

  function setMaterialHover(id: string, hovered: boolean) {
    if (materialHoverTimer.current) clearTimeout(materialHoverTimer.current);
    if (hovered) {
      setHoveredMaterialId(id);
      return;
    }

    materialHoverTimer.current = setTimeout(() => {
      setHoveredMaterialId((current) => (current === id ? null : current));
    }, 120);
  }

  function getEditingTextObject() {
    const object = objects.find((item) => item.id === editingTextId);
    if (!object) return undefined;
    if (!object.parent_material_id) return object;

    const material = materialObjects.find((item) => item.id === object.parent_material_id);
    if (!material) return object;

    return materialAnnotationToBoard(object, getMaterialBounds(material));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <select
            className="field min-w-[180px] max-w-[min(260px,calc(100vw-6rem))] py-2 text-sm font-medium"
            value={lesson.id}
            onChange={(event) => void openLesson(event.target.value)}
            aria-label="Open another lesson whiteboard"
          >
            {lessonOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {formatLessonDropdownDate(option.lesson_date)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {saveStatus === "guest"
              ? "Not saved. Create an account to save your whiteboard."
              : saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "error"
                  ? "Save failed"
                  : "Saved"}
          </span>
          <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100" onClick={() => void closeWhiteboard()} aria-label="Close whiteboard" title="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {uploadError ? <p className="basis-full text-sm text-coral">{uploadError}</p> : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1">
        <section className="relative min-h-0 bg-slate-100">
          <div className="relative h-full min-w-0 overflow-hidden">
            <div className="absolute left-4 top-1/2 z-30 -translate-y-1/2">
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
                isUploading={isUploading}
                uploadMaterial={uploadMaterial}
                exportBoardImage={exportBoardImage}
              />
            </div>
            <div className="absolute left-20 top-4 z-20">
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
            </div>
            <div
              ref={viewportRef}
              className={`relative h-full min-h-[520px] w-full overflow-hidden bg-white ${
                tool === "hand" || spacePressed ? "cursor-grab active:cursor-grabbing" : ""
              }`}
            >
              <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 p-1 shadow-sm">
                <button
                  className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  onClick={() => zoomAt(viewportScale * 0.85)}
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  <ZoomOut size={16} aria-hidden="true" />
                </button>
                <span className="min-w-14 px-1 text-center text-xs font-medium tabular-nums text-slate-600">{Math.round(viewportScale * 100)}%</span>
                <button
                  className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  onClick={() => zoomAt(viewportScale * 1.18)}
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  <ZoomIn size={16} aria-hidden="true" />
                </button>
                <button
                  className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  onClick={resetViewport}
                  aria-label="Reset view"
                  title="Reset view"
                >
                  <Home size={16} aria-hidden="true" />
                </button>
              </div>
              <Stage
                ref={stageRef}
                width={viewportSize.width}
                height={viewportSize.height}
                x={stagePosition.x}
                y={stagePosition.y}
                scaleX={viewportScale}
                scaleY={viewportScale}
                draggable={tool === "hand" || spacePressed}
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                onTouchStart={handleStageMouseDown}
                onTouchMove={handleStageMouseMove}
                onTouchEnd={handleStageMouseUp}
                onDragEnd={(event) => setStagePosition({ x: event.target.x(), y: event.target.y() })}
                onWheel={handleWheel}
              >
                <Layer>
                  <Rect name="canvas-background" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#ffffff" />
                  {rootObjects.filter((object) => object.data.displayState !== "minimized").flatMap((object) => {
                    if (object.id === editingTextId) return [];

                    if (!isMaterialObject(object)) {
                      return [
                        <WhiteboardNode
                          key={object.id}
                          object={object}
                          selected={selectedId === object.id}
                          onSelect={() => {
                            if (tool === "select") setSelectedId(object.id);
                          }}
                          draggable={tool === "select"}
                          listening
                          onChange={(patch) => patchObject(object.id, patch)}
                          onTextEdit={() => setEditingTextId(object.id)}
                          onPdfPageChange={() => undefined}
                          onMaterialSize={() => undefined}
                        />
                      ];
                    }

                    const materialBounds = getMaterialBounds(object);
                    const materialForRender = object;
                    const materialPage = object.type === "pdf" ? Number(object.data.page ?? 1) : null;
                    const annotations = object.data.displayState === "minimized"
                      ? []
                      : objects
                          .filter((item) => item.parent_material_id === object.id)
                          .filter((item) => item.page_number === null || item.page_number === materialPage)
                          .filter((item) => item.id !== editingTextId)
                          .map((item) => materialAnnotationToBoard(item, materialBounds))
                          .sort((a, b) => (a.type === "text" ? 1 : 0) - (b.type === "text" ? 1 : 0));

                    return [
                      <WhiteboardNode
                        key={object.id}
                        object={materialForRender}
                        selected={false}
                        onSelect={() => {
                          if (tool !== "select") return;
                          if (object.data.displayState === "minimized") {
                            patchMaterialData(object.id, { displayState: "normal" });
                            return;
                          }
                        }}
                        draggable={false}
                        listening={false}
                        onHover={(hovered) => setMaterialHover(object.id, hovered)}
                        onChange={(patch) => patchObject(object.id, patch)}
                        onTextEdit={() => undefined}
                        onPdfPageChange={(page, pageCount) => {
                          patchObject(
                            object.id,
                            {
                              data: {
                                ...object.data,
                                page,
                                pageCount
                              }
                            },
                            false
                          );
                        }}
                        onMaterialSize={(size) => {
                          const nextData =
                            object.type === "pdf"
                              ? { ...object.data, pageWidth: size.width, pageHeight: size.height }
                              : { ...object.data, naturalWidth: size.width, naturalHeight: size.height };
                          const sizePatch =
                            object.data.displayMode === "fullBoard"
                              ? fitMaterialToBoard({ ...object, data: nextData }, size)
                              : { ...object, data: nextData };
                          patchObject(object.id, {
                            x: sizePatch.x,
                            y: sizePatch.y,
                            width: sizePatch.width,
                            height: sizePatch.height,
                            data: sizePatch.data
                          }, false);
                        }}
                      />,
                      <Rect
                        key={`${object.id}-hit-surface`}
                        name="material-hit-surface"
                        x={materialBounds.x}
                        y={materialBounds.y}
                        width={materialBounds.width}
                        height={materialBounds.height}
                        fill="rgba(0,0,0,0)"
                        listening
                        onMouseEnter={() => setMaterialHover(object.id, true)}
                        onMouseLeave={() => setMaterialHover(object.id, false)}
                      />,
                      ...annotations.map((annotation) => (
                        <WhiteboardNode
                          key={annotation.id}
                          object={annotation}
                          selected={selectedId === annotation.id}
                          onSelect={() => {
                            if (tool === "select") setSelectedId(annotation.id);
                          }}
                          draggable={tool === "select"}
                          listening
                          onChange={(patch) => patchObject(annotation.id, boardPatchToMaterialPatch(patch, materialBounds))}
                          onTextEdit={() => setEditingTextId(annotation.id)}
                          onPdfPageChange={() => undefined}
                          onMaterialSize={() => undefined}
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
              {materialObjects.map((object) => (
                <MaterialControls
                  key={object.id}
                  object={objectToViewport(object)}
                  visible={selectedId === object.id || hoveredMaterialId === object.id || controlsHoveredMaterialId === object.id}
                  onHover={(hovered) => setControlsHoveredMaterialId(hovered ? object.id : null)}
                  onMinimize={() => minimizeMaterial(object.id)}
                  onClose={() => removeMaterial(object.id)}
                />
              ))}
              {editingTextId ? (
                <InlineTextEditor
                  object={getEditingTextObject() ? objectToViewport(getEditingTextObject()!) : undefined}
                  viewportScale={viewportScale}
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
                  bounds={
                    (() => {
                      const object = objects.find((item) => item.id === selectedId);
                      return object?.type === "pdf" ? viewportRectFromCanvas(getMaterialBounds(object)) : undefined;
                    })()
                  }
                  onPageChange={(page) => {
                    const object = objects.find((item) => item.id === selectedId);
                    if (object?.type === "pdf") {
                      patchObject(object.id, { data: { ...object.data, page } });
                    }
                  }}
                />
              ) : null}
              {minimizedMaterials.length ? (
                <div className="absolute bottom-4 left-1/2 z-20 flex max-w-[min(720px,calc(100%-7rem))] -translate-x-1/2 gap-2 overflow-x-auto rounded-md border border-slate-200 bg-white/95 p-2 shadow-sm">
                  {minimizedMaterials.map((object) => (
                    <button
                      key={object.id}
                      className="flex max-w-56 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => patchMaterialData(object.id, { displayState: "normal" })}
                      title={String(object.data.filename ?? (object.type === "pdf" ? "PDF" : "Image"))}
                    >
                      {object.type === "pdf" ? <FileText size={16} aria-hidden="true" /> : <ImageIcon size={16} aria-hidden="true" />}
                      <span className="truncate">{String(object.data.filename ?? (object.type === "pdf" ? "PDF" : "Image"))}</span>
                    </button>
                  ))}
                </div>
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
  canRedo,
  isUploading,
  uploadMaterial,
  exportBoardImage
}: {
  tool: Tool;
  setTool: (tool: Tool) => void;
  undo: () => void;
  redo: () => void;
  clearBoard: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isUploading: boolean;
  uploadMaterial: (file: File) => Promise<void>;
  exportBoardImage: () => void;
}) {
  const tools = [
    { id: "select", label: "Select", icon: MousePointer2 },
    { id: "hand", label: "Pan", icon: Hand },
    { id: "text", label: "Text", icon: Type },
    { id: "pencil", label: "Pencil", icon: Pencil },
    { id: "highlighter", label: "Highlighter", icon: Highlighter },
    { id: "shape", label: "Shape", icon: Shapes },
    { id: "arrow", label: "Arrow", icon: ArrowLeftRight },
    { id: "delete", label: "Delete", icon: Eraser }
  ] as const;

  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-slate-200 bg-white/95 px-1.5 py-2 shadow-sm">
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
      <label
        className={`rounded-md p-2 ${
          isUploading ? "cursor-not-allowed text-slate-300" : "cursor-pointer text-slate-600 hover:bg-slate-100"
        }`}
        aria-label="Upload material"
        title={isUploading ? "Uploading" : "Upload"}
      >
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
        {isUploading ? <FileText size={19} aria-hidden="true" /> : <ImageIcon size={19} aria-hidden="true" />}
      </label>
      <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100" onClick={exportBoardImage} aria-label="Export board" title="Export">
        <Download size={19} aria-hidden="true" />
      </button>
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
  onHover,
  onMinimize,
  onClose
}: {
  object: WhiteboardObject;
  visible: boolean;
  onHover: (hovered: boolean) => void;
  onMinimize: () => void;
  onClose: () => void;
}) {
  if (!visible || object.data.displayState === "minimized") return null;

  return (
    <div
      className="absolute flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 p-1 shadow-sm"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{
        left: Math.max(8, object.x + object.width - 100),
        top: Math.max(8, object.y + 8)
      }}
    >
      <button className="rounded p-1 text-slate-600 hover:bg-slate-100" onClick={onMinimize} aria-label="Minimize material" title="Minimize">
        <Minus size={15} aria-hidden="true" />
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
  const hasOptions = activeTool === "text" || tool === "pencil" || tool === "highlighter" || tool === "shape" || tool === "arrow" || tool === "delete";

  if (!hasOptions) return null;

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
  draggable,
  listening,
  onChange,
  onTextEdit,
  onPdfPageChange,
  onMaterialSize,
  onHover
}: {
  object: WhiteboardObject;
  selected: boolean;
  onSelect: () => void;
  draggable: boolean;
  listening: boolean;
  onChange: (patch: Partial<WhiteboardObject>) => void;
  onTextEdit: () => void;
  onPdfPageChange: (page: number, pageCount?: number) => void;
  onMaterialSize: (size: { width: number; height: number }) => void;
  onHover?: (hovered: boolean) => void;
}) {
  const common = {
    id: object.id,
    x: object.x,
    y: object.y,
    rotation: object.rotation,
    draggable,
    listening,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      onSelect();
    },
    onTap: (event: Konva.KonvaEventObject<Event>) => {
      event.cancelBubble = true;
      onSelect();
    },
    onMouseDown: (event: Konva.KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
    },
    onMouseEnter: () => onHover?.(true),
    onMouseLeave: () => onHover?.(false),
    onDragStart: (event: Konva.KonvaEventObject<DragEvent>) => {
      event.cancelBubble = true;
    },
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => {
      event.cancelBubble = true;
    },
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      event.cancelBubble = true;
      onChange({ x: event.target.x(), y: event.target.y() });
    },
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      event.cancelBubble = true;
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
        onImageReady={onMaterialSize}
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
        onPageSize={onMaterialSize}
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
  url,
  onImageReady
}: {
  common: Record<string, unknown>;
  object: WhiteboardObject;
  selected: boolean;
  url: string;
  onImageReady: (size: { width: number; height: number }) => void;
}) {
  const image = useCanvasImage(url);

  useEffect(() => {
    if (!image) return;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return;
    if (Number(object.data.naturalWidth) === width && Number(object.data.naturalHeight) === height) return;
    onImageReady({ width, height });
  }, [image, object.data.naturalHeight, object.data.naturalWidth, onImageReady]);

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
  onPageReady,
  onPageSize
}: {
  common: Record<string, unknown>;
  object: WhiteboardObject;
  selected: boolean;
  url: string;
  page: number;
  onPageReady: (page: number, pageCount?: number) => void;
  onPageSize: (size: { width: number; height: number }) => void;
}) {
  const { image, pageCount, pageSize } = usePdfPageImage(url, page);

  useEffect(() => {
    if (pageCount && pageCount !== Number(object.data.pageCount ?? 0)) {
      onPageReady(page, pageCount);
    }
  }, [object.data.pageCount, onPageReady, page, pageCount]);

  useEffect(() => {
    if (!pageSize) return;
    if (Number(object.data.pageWidth) === pageSize.width && Number(object.data.pageHeight) === pageSize.height) return;
    onPageSize(pageSize);
  }, [object.data.pageHeight, object.data.pageWidth, onPageSize, pageSize]);

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
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPdfPage() {
      if (!url) {
        setImage(null);
        setPageSize(null);
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
      setPageSize({ width: viewport.width, height: viewport.height });

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

  return { image, pageCount, pageSize };
}

function InlineTextEditor({
  object,
  viewportScale,
  onDone
}: {
  object?: WhiteboardObject;
  viewportScale: number;
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
      className="absolute resize-none rounded-sm border border-leaf/70 bg-transparent p-1.5 text-ink outline-none ring-2 ring-leaf/25"
      style={{
        left: object.x,
        top: object.y,
        width: Math.max(160, object.width),
        height: Math.max(48, object.height),
        fontSize: Number(object.data.fontSize ?? 28) * viewportScale,
        background: "transparent",
        backgroundColor: "transparent",
        boxShadow: "none",
        caretColor: String(object.data.fill ?? "#172026"),
        color: String(object.data.fill ?? "#172026"),
        WebkitAppearance: "none",
        transform: `rotate(${object.rotation}deg)`,
        transformOrigin: "top left"
      }}
      defaultValue={String(object.data.text ?? "")}
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

function formatLessonDropdownDate(value: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;

  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month} ${day}, ${hour}:${minute}`;
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

function getExportBounds(objects: WhiteboardObject[], materials: WhiteboardObject[]) {
  const visibleObjects = objects
    .filter((object) => {
      if (!object.parent_material_id) return object.data.displayState !== "minimized";
      const material = materials.find((item) => item.id === object.parent_material_id);
      if (!material || material.data.displayState === "minimized") return false;
      if (material.type !== "pdf") return true;
      return object.page_number === null || object.page_number === Number(material.data.page ?? 1);
    })
    .map((object) => {
      if (!object.parent_material_id) return object;

      const material = materials.find((item) => item.id === object.parent_material_id);
      if (!material) return object;
      return materialAnnotationToBoard(object, getMaterialBounds(material));
    });

  if (!visibleObjects.length) {
    return {
      x: 0,
      y: 0,
      width: Math.min(CANVAS_WIDTH, 1200),
      height: Math.min(CANVAS_HEIGHT, 760)
    };
  }

  const boxes = visibleObjects.map(getObjectBounds);
  const margin = 80;
  const minX = Math.max(0, Math.min(...boxes.map((box) => box.x)) - margin);
  const minY = Math.max(0, Math.min(...boxes.map((box) => box.y)) - margin);
  const maxX = Math.min(CANVAS_WIDTH, Math.max(...boxes.map((box) => box.x + box.width)) + margin);
  const maxY = Math.min(CANVAS_HEIGHT, Math.max(...boxes.map((box) => box.y + box.height)) + margin);

  return {
    x: minX,
    y: minY,
    width: Math.max(320, maxX - minX),
    height: Math.max(240, maxY - minY)
  };
}

function getObjectBounds(object: WhiteboardObject) {
  if ((object.type === "pencil_stroke" || object.type === "highlighter_stroke" || object.type === "arrow") && Array.isArray(object.data.points)) {
    const points = object.data.points as number[];
    const xs = points.filter((_, index) => index % 2 === 0);
    const ys = points.filter((_, index) => index % 2 === 1);
    if (xs.length && ys.length) {
      const strokeWidth = Number(object.data.strokeWidth ?? 4);
      const minX = Math.min(...xs) + object.x - strokeWidth;
      const minY = Math.min(...ys) + object.y - strokeWidth;
      const maxX = Math.max(...xs) + object.x + strokeWidth;
      const maxY = Math.max(...ys) + object.y + strokeWidth;
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  }

  return {
    x: object.x,
    y: object.y,
    width: Math.max(1, object.width),
    height: Math.max(1, object.height)
  };
}
