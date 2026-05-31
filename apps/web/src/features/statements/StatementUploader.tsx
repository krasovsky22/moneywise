import { useRef, useState } from "react";
import { Paperclip, X, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCards } from "@/features/cards/useCards";
import { useBankAccounts } from "@/features/bank-accounts/useBankAccounts";
import { useUploadStatement } from "./useStatements";
import type { Statement } from "./statementsApi";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "text/csv"];
const ACCEPTED_EXTENSIONS = [".pdf", ".csv"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface StatementUploaderProps {
  onSuccess?: (statement: Statement) => void;
}

export const StatementUploader = ({ onSuccess }: StatementUploaderProps) => {
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existing_statement_id: string | null;
    existing_uploaded_at: string | null;
  } | null>(null);

  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadStatement();

  const { data: cards } = useCards();
  const { data: bankAccounts } = useBankAccounts();

  const activeCards = (cards ?? []).filter((c) => !c.is_archived);
  const activeBankAccounts = (bankAccounts ?? []).filter((a) => !a.is_archived);

  function validateFile(f: File): string | null {
    if (!ACCEPTED_TYPES.includes(f.type) && !ACCEPTED_EXTENSIONS.some((ext) => f.name.endsWith(ext))) {
      return "Only PDF and CSV files are accepted";
    }
    if (f.size > MAX_FILE_BYTES) {
      return "File must be under 25 MB";
    }
    return null;
  }

  function handleFileChange(f: File) {
    const error = validateFile(f);
    setValidationError(error);
    setDuplicateInfo(null);
    if (!error) setFile(f);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFileChange(f);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function clearFile() {
    setFile(null);
    setValidationError(null);
    setDuplicateInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!file) {
      setValidationError("Please select a file");
      return;
    }
    const fileError = validateFile(file);
    if (fileError) {
      setValidationError(fileError);
      return;
    }
    if (!selectedAccount) {
      setValidationError("Please select an account");
      return;
    }

    setValidationError(null);

    const parts = selectedAccount.split(":");
    const typePrefix = parts[0];
    const accountId = parts.slice(1).join(":");
    const accountType = typePrefix === "card" ? "card" : "bank_account";

    upload.mutate(
      { file, accountType, accountId },
      {
        onSuccess: (response) => {
          if (response.duplicate) {
            setDuplicateInfo({
              existing_statement_id: response.existing_statement_id,
              existing_uploaded_at: response.existing_uploaded_at,
            });
            return;
          }
          toast.success("Statement uploaded and queued for processing.");
          clearFile();
          setSelectedAccount("");
          if (response.statement) {
            onSuccess?.(response.statement);
          }
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Failed to upload statement.";
          toast.error(message);
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="text-base font-semibold">Upload Statement</h2>

      {/* Account picker */}
      <div className="space-y-1.5">
        <Label>Account</Label>
        <Popover open={accountPickerOpen} onOpenChange={setAccountPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={accountPickerOpen}
              aria-label="Select account"
              className="w-full justify-between font-normal"
            >
              <span className="truncate">
                {selectedAccount
                  ? (() => {
                      const cardMatch = activeCards.find((c) => `card:${c.id}` === selectedAccount);
                      if (cardMatch) return cardMatch.nickname;
                      const bankMatch = activeBankAccounts.find((a) => `bank:${a.id}` === selectedAccount);
                      if (bankMatch) return bankMatch.nickname;
                      return "Select an account…";
                    })()
                  : "Select an account…"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search accounts…" />
              <CommandList>
                <CommandEmpty>No account found.</CommandEmpty>
                {activeCards.length > 0 && (
                  <CommandGroup heading="Credit Cards">
                    {activeCards.map((card) => (
                      <CommandItem
                        key={card.id}
                        value={card.nickname}
                        onSelect={() => {
                          setSelectedAccount(`card:${card.id}`);
                          setAccountPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedAccount === `card:${card.id}` ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {card.nickname}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {activeBankAccounts.length > 0 && (
                  <CommandGroup heading="Bank Accounts">
                    {activeBankAccounts.map((account) => (
                      <CommandItem
                        key={account.id}
                        value={account.nickname}
                        onSelect={() => {
                          setSelectedAccount(`bank:${account.id}`);
                          setAccountPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedAccount === `bank:${account.id}` ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {account.nickname}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Drop zone */}
      {!file && (
        <div
          role="button"
          tabIndex={0}
          aria-label="File drop zone. Click to browse or drag a file here."
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
          )}
        >
          <Paperclip className="h-6 w-6" />
          <p className="text-sm">Drag a PDF or CSV here, or click to browse</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.csv"
        className="hidden"
        onChange={handleInputChange}
        aria-hidden="true"
      />

      {/* Selected file indicator */}
      {file && (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={clearFile}
            aria-label="Remove selected file"
            className="shrink-0 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <p role="alert" className="text-sm text-destructive">
          {validationError}
        </p>
      )}

      {/* Duplicate notice */}
      {duplicateInfo && (
        <div
          role="status"
          className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300"
        >
          You already uploaded this file
          {duplicateInfo.existing_uploaded_at
            ? ` on ${formatDate(duplicateInfo.existing_uploaded_at)}`
            : ""}
          . No duplicate was created.
        </div>
      )}

      {/* Submit */}
      <Button type="submit" disabled={upload.isPending} className="w-full">
        {upload.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {upload.isPending ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
};
