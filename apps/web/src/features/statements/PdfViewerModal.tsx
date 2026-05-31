import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchStatementFileBlob } from "./statementsApi";

interface PdfViewerModalProps {
  statementId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PdfViewerModal = ({
  statementId,
  fileName,
  open,
  onOpenChange,
}: PdfViewerModalProps) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetchStatementFileBlob(statementId)
      .then((blob) => setObjectUrl(URL.createObjectURL(blob)))
      .catch(() => setError("Failed to load file."))
      .finally(() => setIsLoading(false));
  }, [open, statementId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col gap-3 p-4">
        <DialogHeader>
          <DialogTitle className="truncate pr-6 text-sm">{fileName}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : objectUrl ? (
            <iframe
              src={objectUrl}
              className="h-full w-full rounded border-0"
              title={fileName}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
