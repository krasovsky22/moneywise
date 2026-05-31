import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        result.push({
          id: child.id,
          label: `  ${childIcon}${child.name}`,
          isParent: false,
        });
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
  const flat = flattenCategories(categories);

  return (
    <Select
      value={value ?? ""}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 min-w-[160px] text-xs" aria-label="Select category">
        <SelectValue placeholder="Uncategorized" />
      </SelectTrigger>
      <SelectContent>
        {flat.map((item) => (
          <SelectItem
            key={item.id}
            value={item.id}
            className={item.isParent ? "font-medium" : "pl-10"}
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
