import { useState } from "react";
import { X, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CategoryPicker } from "./CategoryPicker";
import { useCategories } from "@/features/categories/useCategories";

interface BulkActionsBarProps {
  selectedCount: number;
  onRecategorize: (categoryId: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

export const BulkActionsBar = ({
  selectedCount,
  onRecategorize,
  onDelete,
  onClear,
}: BulkActionsBarProps) => {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const { data: categories = [] } = useCategories();

  const handleCategoryChange = (categoryId: string) => {
    onRecategorize(categoryId);
    setCategoryOpen(false);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
      <span className="font-medium text-primary">
        {selectedCount} transaction{selectedCount !== 1 ? "s" : ""} selected
      </span>

      <div className="flex items-center gap-2 ml-auto">
        <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Recategorize
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="end">
            <p className="mb-2 text-xs text-muted-foreground px-1">
              Apply category to {selectedCount} transaction{selectedCount !== 1 ? "s" : ""}
            </p>
            <CategoryPicker
              value={null}
              onChange={handleCategoryChange}
              categories={categories}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete selected
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
