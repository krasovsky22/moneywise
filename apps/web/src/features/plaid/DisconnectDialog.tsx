import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDisconnectItem } from "./usePlaid";

interface DisconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  institutionName: string;
}

export const DisconnectDialog = ({
  open,
  onOpenChange,
  itemId,
  institutionName,
}: DisconnectDialogProps) => {
  const disconnect = useDisconnectItem();

  const handleConfirm = async () => {
    await disconnect.mutateAsync(itemId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disconnect {institutionName}?</DialogTitle>
          <DialogDescription>
            This will stop future syncs and remove the connection. Historical
            transactions will be preserved.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={disconnect.isPending}
          >
            {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
