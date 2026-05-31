import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2, Plus, ChevronRight, Smile } from "lucide-react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCategories,
  useCategoryRules,
  useCreateCategory,
  useDeleteCategory,
  useCreateRule,
  useDeleteRule,
} from "@/features/categories/useCategories";
import type { Category } from "@/features/categories/categoriesApi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/secure/settings/categories")({
  component: CategoriesSettingsPage,
});

function CategoriesSettingsPage() {
  return (
    <div className="space-y-6">
      <CategoriesCard />
      <RulesCard />
    </div>
  );
}

function CategoriesCard() {
  const { data: categories, isLoading, isError } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"spending" | "income" | "transfer">(
    "spending",
  );
  const [parentId, setParentId] = useState<string>("none");
  const [icon, setIcon] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  console.log("1111111", categories);
  const topLevel = categories ?? [];

  function resetForm() {
    setName("");
    setKind("spending");
    setParentId("none");
    setIcon("");
    setPickerOpen(false);
    setShowForm(false);
  }

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createCategory.mutate(
      {
        name: trimmed,
        kind,
        parent_id: parentId === "none" ? null : parentId,
        icon: icon.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(`Category "${trimmed}" added`);
          resetForm();
        },
        onError: () => {
          toast.error("Failed to add category.");
        },
      },
    );
  }

  function handleDelete(cat: Category) {
    if (!window.confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
    deleteCategory.mutate(cat.id, {
      onSuccess: () => toast.success(`"${cat.name}" deleted`),
      onError: () => toast.error("Failed to delete category."),
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            System categories are read-only. Add custom categories to organise
            your transactions.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="rounded-md border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">New category</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-muted-foreground mb-1 block">
                  Name *
                </label>
                <Input
                  placeholder="e.g. Side Income"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Icon (emoji)
                </label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      {icon ? (
                        <span className="text-base">{icon}</span>
                      ) : (
                        <>
                          <Smile className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Pick emoji
                          </span>
                        </>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-none shadow-none">
                    <EmojiPicker
                      onEmojiClick={(emojiData: EmojiClickData) => {
                        setIcon(emojiData.emoji);
                        setPickerOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Kind
                </label>
                <Select
                  value={kind}
                  onValueChange={(v) => setKind(v as typeof kind)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spending">Spending</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Parent (optional)
                </label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Top-level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Top-level</SelectItem>
                    {topLevel.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ""}
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                disabled={!name.trim() || createCategory.isPending}
                onClick={handleAdd}
              >
                {createCategory.isPending ? "Adding…" : "Add category"}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive">Failed to load categories.</p>
        )}

        {!isLoading && !isError && (
          <CategoriesList
            categories={topLevel}
            onDelete={handleDelete}
            deletingId={deleteCategory.variables ?? null}
            isDeleting={deleteCategory.isPending}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface CategoriesListProps {
  categories: Category[];
  onDelete: (cat: Category) => void;
  deletingId: string | null;
  isDeleting: boolean;
}

function CategoriesList({
  categories,
  onDelete,
  deletingId,
  isDeleting,
}: CategoriesListProps) {
  const [systemExpanded, setSystemExpanded] = useState(false);
  const system = categories.filter((c) => c.is_system);
  const custom = categories.filter((c) => !c.is_system);

  console.log("asdasdasd", categories, custom, system);

  return (
    <div className="space-y-1">
      {custom.length > 0 && (
        <ul className="space-y-1">
          {custom.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              onDelete={onDelete}
              deletingId={deletingId}
              isDeleting={isDeleting}
            />
          ))}
        </ul>
      )}

      {system.length > 0 && (
        <div>
          <button
            onClick={() => setSystemExpanded((v) => !v)}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                systemExpanded && "rotate-90",
              )}
            />
            System categories ({system.length})
          </button>
          {systemExpanded && (
            <ul className="mt-1 space-y-1">
              {system.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  onDelete={onDelete}
                  deletingId={deletingId}
                  isDeleting={isDeleting}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface CategoryRowProps {
  cat: Category;
  onDelete: (cat: Category) => void;
  deletingId: string | null;
  isDeleting: boolean;
  depth?: number;
}

function CategoryRow({
  cat,
  onDelete,
  deletingId,
  isDeleting,
  depth = 0,
}: CategoryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = cat.children.length > 0;

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50",
          depth > 0 && "ml-6",
        )}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}

        {cat.icon && (
          <span className="shrink-0 text-base leading-none">{cat.icon}</span>
        )}

        <span className="flex-1 truncate font-medium">{cat.name}</span>

        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            cat.kind === "income"
              ? "bg-green-100 text-green-700"
              : cat.kind === "transfer"
                ? "bg-blue-100 text-blue-700"
                : "bg-orange-100 text-orange-700",
          )}
        >
          {cat.kind}
        </span>

        {cat.is_system ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            system
          </span>
        ) : (
          <button
            onClick={() => onDelete(cat)}
            disabled={isDeleting && deletingId === cat.id}
            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
            aria-label={`Delete ${cat.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <ul>
          {cat.children.map((child) => (
            <CategoryRow
              key={child.id}
              cat={child}
              onDelete={onDelete}
              deletingId={deletingId}
              isDeleting={isDeleting}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function RulesCard() {
  const { data: categories } = useCategories();
  const { data: rules, isLoading, isError } = useCategoryRules();
  const createRule = useCreateRule();
  const deleteRule = useDeleteRule();

  const [showForm, setShowForm] = useState(false);
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const allFlat = flattenCategories(categories ?? []);

  function resetForm() {
    setPattern("");
    setCategoryId("");
    setShowForm(false);
  }

  function handleAdd() {
    const trimmed = pattern.trim();
    if (!trimmed || !categoryId) return;
    createRule.mutate(
      { pattern: trimmed, category_id: categoryId },
      {
        onSuccess: () => {
          toast.success("Rule added");
          resetForm();
        },
        onError: () => toast.error("Failed to add rule."),
      },
    );
  }

  function handleDelete(id: string) {
    deleteRule.mutate(id, {
      onSuccess: () => toast.success("Rule deleted"),
      onError: () => toast.error("Failed to delete rule."),
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Auto-categorisation Rules</CardTitle>
          <CardDescription>
            When a transaction description contains a pattern, it is
            automatically assigned the matching category.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="rounded-md border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">New rule</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Pattern *
                </label>
                <Input
                  placeholder="e.g. UBER"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Category *
                </label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allFlat.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ""}
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                disabled={
                  !pattern.trim() || !categoryId || createRule.isPending
                }
                onClick={handleAdd}
              >
                {createRule.isPending ? "Adding…" : "Add rule"}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 rounded bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive">Failed to load rules.</p>
        )}

        {!isLoading && !isError && (rules ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No rules yet.</p>
        )}

        {!isLoading && !isError && (rules ?? []).length > 0 && (
          <ul className="space-y-1">
            {(rules ?? []).map((rule) => {
              const cat = allFlat.find((c) => c.id === rule.category_id);
              return (
                <li
                  key={rule.id}
                  className="group flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <code className="flex-1 truncate rounded bg-muted px-2 py-0.5 text-xs font-mono">
                    {rule.pattern}
                  </code>
                  <span className="text-muted-foreground">→</span>
                  <span className="shrink-0 text-sm">
                    {cat ? (
                      <>
                        {cat.icon && `${cat.icon} `}
                        {cat.name}
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">
                        Unknown
                      </span>
                    )}
                  </span>
                  {rule.hit_count > 0 && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {rule.hit_count}×
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(rule.id)}
                    disabled={
                      deleteRule.isPending && deleteRule.variables === rule.id
                    }
                    className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                    aria-label={`Delete rule for ${rule.pattern}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function flattenCategories(cats: Category[]): Category[] {
  const result: Category[] = [];
  for (const cat of cats) {
    result.push(cat);
    if (cat.children.length > 0) {
      result.push(...flattenCategories(cat.children));
    }
  }
  return result;
}
