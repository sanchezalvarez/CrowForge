import { useState, useRef, useMemo } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PMTask, PMTaskStatus, PMItemType, PMMember } from "../../types/pm";
import { TaskCard } from "./TaskCard";

interface KanbanBoardProps {
  tasks: PMTask[];
  members: PMMember[];
  onTaskClick: (task: PMTask) => void;
  onStatusChange: (taskId: number, newStatus: PMTaskStatus) => Promise<void>;
  onReorder: (items: { id: number; position: number; status?: PMTaskStatus }[]) => Promise<void>;
  onTaskCreate: (status: PMTaskStatus) => void;
}

const COLUMNS: PMTaskStatus[] = ["new", "active", "ready_to_go", "needs_testing", "resolved", "rejected"];
const COLUMN_LABELS: Record<PMTaskStatus, string> = {
  new:           "New",
  active:        "Active",
  ready_to_go:   "Ready to Go",
  needs_testing: "Needs Testing",
  resolved:      "Resolved",
  rejected:      "Rejected",
  closed:        "Closed",
};
const COLUMN_COLORS: Record<PMTaskStatus, string> = {
  new:           "bg-muted-foreground/30",
  active:        "bg-primary",
  ready_to_go:   "bg-blue-500",
  needs_testing: "bg-amber-500",
  resolved:      "bg-teal-600",
  rejected:      "bg-destructive",
  closed:        "bg-muted-foreground/50",
};

// Riso accent color per column status for shadow
const COLUMN_SHADOW: Record<PMTaskStatus, string> = {
  new:           "rgba(20,16,10,0.10)",
  active:        "rgba(224,78,14,0.22)",
  ready_to_go:   "rgba(37,99,235,0.18)",
  needs_testing: "rgba(245,158,11,0.22)",
  resolved:      "rgba(11,114,104,0.22)",
  rejected:      "rgba(220,38,38,0.22)",
  closed:        "rgba(20,16,10,0.10)",
};

const ALL_TYPES: PMItemType[] = ["epic", "feature", "story", "task", "spike"];
const DEFAULT_SHOWN: Set<PMItemType> = new Set(ALL_TYPES);

export function KanbanBoard({ tasks, members, onTaskClick, onStatusChange, onReorder, onTaskCreate: _onTaskCreate }: KanbanBoardProps) {
  const dragging = useRef(false);
  const [shownTypes, setShownTypes] = useState<Set<PMItemType>>(DEFAULT_SHOWN);

  const filteredTasks = useMemo(
    () => tasks.filter((t) => shownTypes.has(t.item_type)),
    [tasks, shownTypes]
  );

  const grouped = useMemo(
    () => COLUMNS.reduce(
      (acc, s) => ({
        ...acc,
        [s]: filteredTasks.filter((t) => t.status === s).sort((a, b) => a.position - b.position),
      }),
      {} as Record<PMTaskStatus, PMTask[]>
    ),
    [filteredTasks]
  );

  const toggleType = (type: PMItemType) => {
    setShownTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const onDragEnd = async (result: DropResult) => {
    if (dragging.current) return;
    dragging.current = true;

    try {
      const { source, destination } = result;
      if (!destination) return;

      const srcStatus = source.droppableId as PMTaskStatus;
      const dstStatus = destination.droppableId as PMTaskStatus;
      const srcItems = [...grouped[srcStatus]];
      const [moved] = srcItems.splice(source.index, 1);

      if (srcStatus === dstStatus) {
        srcItems.splice(destination.index, 0, moved);
        await onReorder(srcItems.map((t, i) => ({ id: t.id, position: (i + 1) * 1000 })));
      } else {
        const dstItems = [...grouped[dstStatus]];
        dstItems.splice(destination.index, 0, { ...moved, status: dstStatus });
        await onStatusChange(moved.id, dstStatus);
        await onReorder([
          ...srcItems.map((t, i) => ({ id: t.id, position: (i + 1) * 1000 })),
          ...dstItems.map((t, i) => ({ id: t.id, position: (i + 1) * 1000, status: dstStatus })),
        ]);
      }
    } finally {
      dragging.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
        <span className="text-[10px] text-muted-foreground font-mono-ui mr-1 tracking-wide uppercase">Show:</span>
        {ALL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`btn-tactile text-[10px] transition-all ${
              shownTypes.has(type)
                ? "btn-tactile-orange"
                : "btn-tactile-outline opacity-50"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0 w-full">
          {COLUMNS.map((status) => {
            const col = grouped[status];
            return (
              <div
                key={status}
                className="flex flex-col flex-1 min-w-[160px] animate-column-in"
                style={{ animationDelay: `${COLUMNS.indexOf(status) * 40}ms` }}
              >
                {/* Column header — riso styled */}
                <div
                  className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md surface-noise"
                  style={{
                    border: "1.5px solid rgba(20,16,10,0.14)",
                    boxShadow: `2px 2px 0 ${COLUMN_SHADOW[status]}`,
                    background: "var(--background-2)",
                  }}
                >
                  <span className={`w-2.5 h-2.5 rounded-sm ${COLUMN_COLORS[status]}`} style={{ border: "1px solid rgba(20,16,10,0.20)" }} />
                  <span className="text-xs font-display font-black tracking-tight text-foreground">{COLUMN_LABELS[status]}</span>
                  <span
                    className="text-[10px] font-mono-ui ml-auto px-1.5 rounded"
                    style={{
                      background: "var(--background-3)",
                      border: "1px solid var(--border-strong)",
                      color: "var(--muted-foreground)",
                    }}
                  >{col.length}</span>
                </div>

                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex flex-col gap-3 min-h-[120px] rounded-md p-3 transition-colors flex-1"
                      style={{
                        background: snapshot.isDraggingOver
                          ? `color-mix(in srgb, var(--accent-orange) 6%, var(--background-2))`
                          : "var(--background-2)",
                        border: snapshot.isDraggingOver
                          ? "1.5px dashed var(--accent-orange)"
                          : "1.5px solid rgba(20,16,10,0.10)",
                      }}
                    >
                      {col.map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className="animate-card-in"
                              style={{ ...dragProvided.draggableProps.style, animationDelay: `${index * 30}ms` }}
                            >
                              <TaskCard
                                task={task}
                                members={members}
                                onClick={() => onTaskClick(task)}
                                dragHandleProps={dragProvided.dragHandleProps as unknown as Record<string, unknown>}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
