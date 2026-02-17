import { useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw, Eye } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import type { GenerationVersion } from "../types";

interface VersionHistoryProps {
  versions: GenerationVersion[];
  viewingVersionId: number | null;
  isBusy: boolean;
  onView: (versionId: number) => void;
  onRestore: (versionId: number) => void;
  onBackToCurrent: () => void;
}

export function VersionHistory({
  versions,
  viewingVersionId,
  isBusy,
  onView,
  onRestore,
  onBackToCurrent,
}: VersionHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState<number | null>(null);

  if (versions.length === 0) return null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "Z");
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleConfirmRestore = () => {
    if (confirmRestoreId !== null) {
      onRestore(confirmRestoreId);
      setConfirmRestoreId(null);
    }
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      {/* Viewing-old-version banner */}
      {viewingVersionId !== null && (
        <div className="flex items-center justify-between gap-2 bg-blue-50 border-b border-blue-200 px-4 py-2 rounded-t-lg text-sm text-blue-700">
          <span>
            Viewing version #{viewingVersionId} — this is not the current version.
          </span>
          <Button variant="outline" size="sm" onClick={onBackToCurrent}>
            Back to current
          </Button>
        </div>
      )}

      {/* Header toggle */}
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <span className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Version History
          <Badge variant="secondary" className="ml-1 text-xs">
            {versions.length}
          </Badge>
        </span>
      </button>

      {/* Version list */}
      {expanded && (
        <div className="border-t px-4 pb-3 pt-1 space-y-1 max-h-64 overflow-y-auto">
          {versions.map((v, idx) => {
            const isCurrent = idx === 0;
            const isViewing = viewingVersionId === v.id;
            const versionNum = versions.length - idx;
            return (
              <div
                key={v.id}
                className={`flex items-center justify-between py-2 px-2 rounded text-sm ${
                  isViewing ? "bg-blue-50" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono text-xs w-6">
                    v{versionNum}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDate(v.created_at)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {v.content.length} concept{v.content.length !== 1 ? "s" : ""}
                  </span>
                  {isCurrent && (
                    <Badge variant="default" className="text-xs py-0">
                      Current
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!isViewing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={isBusy}
                      onClick={() => onView(v.id)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  )}
                  {!isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={isBusy}
                      onClick={() => setConfirmRestoreId(v.id)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm restore dialog */}
      <Dialog
        open={confirmRestoreId !== null}
        onOpenChange={(open) => !open && setConfirmRestoreId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore this version?</DialogTitle>
            <DialogDescription>
              This will replace your current concepts with the selected version.
              The current version will remain in version history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmRestoreId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRestore}
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
