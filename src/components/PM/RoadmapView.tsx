import { useMemo } from "react";
import { PMTask, PMMember } from "../../types/pm";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import { StatusBadge } from "./StatusBadge";
import { MemberAvatar } from "./MemberAvatar";
import { formatDate } from "../../lib/pmUtils";
import { Calendar, AlertCircle, ChevronRight } from "lucide-react";

interface RoadmapViewProps {
  tasks: PMTask[];
  members: PMMember[];
  onTaskClick: (task: PMTask) => void;
}

export function RoadmapView({ tasks, members, onTaskClick }: RoadmapViewProps) {
  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  );

  // Group Epics and Features by month
  const groupedRoadmap = useMemo(() => {
    const items = tasks
      .filter((t) => t.item_type === "epic" || t.item_type === "feature")
      .sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });

    const groups: Record<string, PMTask[]> = {};
    
    items.forEach(item => {
      let monthKey = "No Date";
      if (item.due_date) {
        const date = new Date(item.due_date + "T00:00:00");
        monthKey = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      }
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(item);
    });

    return groups;
  }, [tasks]);

  const today = new Date().toISOString().split("T")[0];

  if (Object.keys(groupedRoadmap).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/5 rounded-xl border border-dashed border-border">
        <Calendar size={40} className="mb-4 opacity-20" />
        <p>No Epics or Features found. Create some to see the roadmap.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {Object.entries(groupedRoadmap).map(([month, items], groupIdx) => (
        <div key={month} className="space-y-4 animate-column-in" style={{ animationDelay: `${groupIdx * 60}ms` }}>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {month}
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map((item, cardIdx) => {
              const assignee = item.assignee_id ? memberMap[item.assignee_id] : null;
              const isOverdue = item.due_date && item.due_date < today && !["resolved", "closed", "rejected"].includes(item.status);

              return (
                <div
                  key={item.id}
                  className={`group relative flex flex-col p-3 rounded-lg border surface-noise cursor-pointer transition-all duration-100 animate-card-in ${
                    isOverdue
                      ? "border-destructive/30 bg-destructive/5"
                      : "bg-card"
                  }`}
                  style={{
                    animationDelay: `${cardIdx * 30}ms`,
                    borderColor: isOverdue ? undefined : "rgba(20,16,10,0.18)",
                    boxShadow: isOverdue
                      ? "2px 2px 0 rgba(220,38,38,0.20)"
                      : "2px 2px 0 var(--riso-teal)",
                  }}
                  onClick={() => onTaskClick(item)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)";
                    (e.currentTarget as HTMLElement).style.boxShadow = isOverdue
                      ? "3px 3px 0 rgba(220,38,38,0.25)"
                      : "3px 3px 0 var(--riso-teal)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "";
                    (e.currentTarget as HTMLElement).style.boxShadow = isOverdue
                      ? "2px 2px 0 rgba(220,38,38,0.20)"
                      : "2px 2px 0 var(--riso-teal)";
                  }}
                >
                  {/* Top Row: Type & Status */}
                  <div className="flex items-center justify-between mb-2">
                    <WorkItemTypeBadge type={item.item_type} iconOnly />
                    <StatusBadge status={item.status} className="font-mono text-[9px]" />
                  </div>

                  {/* Title */}
                  <div>
                    <h3 className="font-bold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Bottom Row: Date & Assignee */}
                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                    <div className={`flex items-center gap-1.5 text-[10px] font-mono ${isOverdue ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                      <Calendar size={11} />
                      <span>{item.due_date ? formatDate(item.due_date) : "TBD"}</span>
                    </div>
                    <MemberAvatar member={assignee} size="sm" />
                  </div>

                  {/* Overdue Indicator */}
                  {isOverdue && (
                    <div className="absolute -top-1.5 -right-1.5 bg-destructive text-white p-0.5 rounded-full shadow">
                      <AlertCircle size={12} />
                    </div>
                  )}

                  {/* Hover Arrow */}
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                    <ChevronRight size={14} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
