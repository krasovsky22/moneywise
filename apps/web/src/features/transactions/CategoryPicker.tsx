import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import type { Category } from "@/features/categories/categoriesApi";

interface CategoryPickerProps {
  value: string | null;
  onChange: (id: string) => void;
  categories: Category[];
  disabled?: boolean;
}

interface FlatCategory {
  id: string;
  label: string;
  isParent: boolean;
}

function flattenCategories(categories: Category[]): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const cat of categories) {
    const icon = cat.icon ? `${cat.icon} ` : "";
    if (cat.children.length > 0) {
      result.push({ id: cat.id, label: `${icon}${cat.name}`, isParent: true });
      for (const child of cat.children) {
        const childIcon = child.icon ? `${child.icon} ` : "";
        result.push({ id: child.id, label: `${childIcon}${child.name}`, isParent: false });
      }
    } else {
      result.push({ id: cat.id, label: `${icon}${cat.name}`, isParent: false });
    }
  }
  return result;
}

export const CategoryPicker = ({
  value,
  onChange,
  categories,
  disabled,
}: CategoryPickerProps) => {
  const [open, setOpen] = useState(false);
  const flat = flattenCategories(categories);
  const selected = flat.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select category"
          disabled={disabled}
          className="h-9 w-full justify-between text-xs font-normal"
        >
          <span className="truncate">{selected ? selected.label : "Uncategorized"}</span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories…" className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="py-4 text-xs text-center">No category found.</CommandEmpty>
            <CommandGroup>
              {flat.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  className={cn("text-xs", item.isParent ? "font-medium" : "pl-6")}
                >
                  <Check
                    className={cn("mr-2 h-3 w-3", value === item.id ? "opacity-100" : "opacity-0")}
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
