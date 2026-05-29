import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CardChip } from "./CardChip";
import { CardForm } from "./CardForm";
import {
  useCards,
  useCreateCard,
  useUpdateCard,
  useArchiveCard,
  useUnarchiveCard,
} from "./useCards";
import type { Card, CardCreate } from "./cardsApi";

type DialogState =
  | { type: "closed" }
  | { type: "create" }
  | { type: "edit"; card: Card }
  | { type: "archive"; card: Card };

export const CardsSettings = () => {
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: "closed" });

  const { data: cards, isLoading, isError } = useCards(showArchived);
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const archiveCard = useArchiveCard();
  const unarchiveCard = useUnarchiveCard();

  function handleCreate(data: CardCreate) {
    createCard.mutate(data, {
      onSuccess: () => {
        toast.success("Card added.");
        setDialog({ type: "closed" });
      },
      onError: () => {
        toast.error("Failed to add card.");
      },
    });
  }

  function handleUpdate(cardId: string, data: CardCreate) {
    updateCard.mutate(
      { cardId, data },
      {
        onSuccess: () => {
          toast.success("Card updated.");
          setDialog({ type: "closed" });
        },
        onError: () => {
          toast.error("Failed to update card.");
        },
      }
    );
  }

  function handleArchive(cardId: string) {
    archiveCard.mutate(cardId, {
      onSuccess: () => {
        toast.success("Card archived.");
        setDialog({ type: "closed" });
      },
      onError: () => {
        toast.error("Failed to archive card.");
      },
    });
  }

  function handleUnarchive(cardId: string) {
    unarchiveCard.mutate(cardId, {
      onSuccess: () => {
        toast.success("Card restored.");
      },
      onError: () => {
        toast.error("Failed to restore card.");
      },
    });
  }

  const visibleCards = cards ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium leading-none">Credit Cards</p>
        <Button
          size="sm"
          onClick={() => setDialog({ type: "create" })}
          aria-label="Add credit card"
        >
          Add card
        </Button>
      </div>

      {/* Show archived toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={showArchived}
          onClick={() => setShowArchived((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <span
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${showArchived ? "bg-primary" : "bg-input"}`}
            aria-hidden="true"
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${showArchived ? "translate-x-3.5" : "translate-x-0.5"}`}
            />
          </span>
          Show archived
        </button>
      </div>

      {/* Card list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load cards.</p>
      ) : visibleCards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showArchived ? "No cards found." : "No cards yet. Add one to get started."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleCards.map((card) => (
            <li
              key={card.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <CardChip card={card} className="shrink-0" />
                <div className="min-w-0 text-sm text-muted-foreground">
                  <span>{card.issuer}</span>
                  <span className="mx-1.5">·</span>
                  <span>Closes {card.statement_close_day}</span>
                  <span className="mx-1.5">·</span>
                  <span>Due {card.payment_due_day}</span>
                </div>
                {card.is_default && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    Default
                  </Badge>
                )}
                {card.is_archived && (
                  <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                    Archived
                  </Badge>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {card.is_archived ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnarchive(card.id)}
                    disabled={unarchiveCard.isPending}
                    aria-label={`Unarchive ${card.nickname}`}
                  >
                    Unarchive
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDialog({ type: "edit", card })}
                      aria-label={`Edit ${card.nickname}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDialog({ type: "archive", card })}
                      aria-label={`Archive ${card.nickname}`}
                    >
                      Archive
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create dialog */}
      <Dialog
        open={dialog.type === "create"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "closed" });
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add card</DialogTitle>
            <DialogDescription>
              Add a credit card to track billing cycles for your household.
            </DialogDescription>
          </DialogHeader>
          <CardForm
            onSubmit={handleCreate}
            isPending={createCard.isPending}
            submitLabel="Add card"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={dialog.type === "edit"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "closed" });
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit card</DialogTitle>
            <DialogDescription>Update the details for this card.</DialogDescription>
          </DialogHeader>
          {dialog.type === "edit" && (
            <CardForm
              defaultValues={dialog.card}
              onSubmit={(data) => handleUpdate(dialog.card.id, data)}
              isPending={updateCard.isPending}
              submitLabel="Save changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Archive confirmation dialog */}
      <Dialog
        open={dialog.type === "archive"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "closed" });
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive card?</DialogTitle>
            <DialogDescription>
              Existing statements and transactions remain. The card stops
              appearing in new uploads and dashboards.
            </DialogDescription>
          </DialogHeader>
          {dialog.type === "archive" && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDialog({ type: "closed" })}
                disabled={archiveCard.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleArchive(dialog.card.id)}
                disabled={archiveCard.isPending}
                aria-label={`Confirm archive ${dialog.card.nickname}`}
              >
                {archiveCard.isPending ? "Archiving…" : "Archive"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
