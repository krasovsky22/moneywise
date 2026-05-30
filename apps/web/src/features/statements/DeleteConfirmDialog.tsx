import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteStatement } from "./useStatements";

interface DeleteConfirmDialogProps {
  statementId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export const DeleteConfirmDialog = ({
  statementId,
  fileName,
  open,
  onOpenChange,
  onDeleted,
}: DeleteConfirmDialogProps) => {
  const deleteStatement = useDeleteStatement();

  function handleDelete() {
    deleteStatement.mutate(statementId, {
      onSuccess: () => {
        toast.success("Statement deleted.");
        onOpenChange(false);
        onDeleted?.();
      },
      onError: () => {
        toast.error("Failed to delete statement.");
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete statement?</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{fileName}</strong>. Any
            transactions imported from this statement will also be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteStatement.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteStatement.isPending}
            aria-label={`Confirm delete ${fileName}`}
          >
            {deleteStatement.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {deleteStatement.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
