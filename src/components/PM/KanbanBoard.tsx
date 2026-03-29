import { useState, useRef, useMemo } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
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
  resolved:      "bg-teal-500",
  rejected:      "bg-destructive",
  closed:        "bg-muted-foreground/50",
};

const ALL_TYPES: PMItemType[] = ["epic", "feature", "story", "task", "bug", "spike"];
// Hide epics/features by default — they're too coarse for kanban
const DEFAULT_SHOWN: Set<PMItemType> = new Set(["story", "task", "bug", "spike"]);

export function KanbanBoard({ tasks, members, onTaskClick, onStatusChange, onReorder, onTaskCreate }: KanbanBoardProps) {
  const dragging = useRef(false);
  const [shownTypes, setShownTypes] = useState<Set<PMItemType>>(DEFAULT_SHOWN);

  const filteredTasks = useMemo(
    () => tasks.filter((t) => shownTypes.has(t.item_type) && t.parent_id === null),
    [tasks, shownTypes]
  );

  const grouped = COLUMNS.reduce(
    (acc, s) => ({
      ...acc,
      [s]: filteredTasks.filter((t) => t.status === s).sort((a, b) => a.position - b.position),
    }),
    {} as Record<PMTaskStatus, PMTask[]>
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
    setTimeout(() => { dragging.current = false; }, 100);

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
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-1 flex-wrap flex-shrink-0">
        <span className="text-xs text-muted-foreground font-mono mr-1">Show:</span>
        {ALL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors ${
              shownTypes.has(type)
                ? "bg-muted border-border text-foreground"
                : "bg-transparent border-transparent text-muted-foreground/40"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0 w-full">
          {COLUMNS.map((status) => {
            const col = grouped[status];
            const totalSP = col.reduce((sum, t) => sum + (t.story_points ?? 0), 0);
            return (
              <div key={status} className="flex flex-col flex-1 min-w-[160px]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${COLUMN_COLORS[status]}`} />
                  <span className="text-sm font-semibold text-foreground">{COLUMN_LABELS[status]}</span>
                  <span className="text-xs text-muted-foreground font-mono ml-1">{col.length}</span>
                  {totalSP > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono ml-auto">({totalSP} SP)</span>
                  )}
                </div>

                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-col gap-2 min-h-[120px] rounded-lg p-2 transition-colors flex-1 ${
                        snapshot.isDraggingOver ? "bg-primary/5 border border-primary/20" : "bg-muted/20"
                      }`}
                    >
                      {col.map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                          {(dragProvided) => (
                            <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
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
                      <button
                        onClick={() => onTaskCreate(status)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
                      >
                        <Plus size={12} /> Add item
                      </button>
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
