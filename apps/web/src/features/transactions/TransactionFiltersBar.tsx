import { useEffect, useRef, useState } from "react";
import { Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useCategories } from "@/features/categories/useCategories";
import { useCards } from "@/features/cards/useCards";
import type { TransactionFilters, TransactionType } from "./transactionsApi";

interface TransactionFiltersBarProps {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
}

type DatePreset = "this_month" | "last_3_months" | "this_year" | "custom";

function getPresetDates(preset: DatePreset): { date_from: string; date_to: string } | null {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === "this_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { date_from: fmt(from), date_to: fmt(to) };
  }
  if (preset === "last_3_months") {
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { date_from: fmt(from), date_to: fmt(to) };
  }
  if (preset === "this_year") {
    return {
      date_from: `${now.getFullYear()}-01-01`,
      date_to: `${now.getFullYear()}-12-31`,
    };
  }
  return null;
}

function detectPreset(filters: TransactionFilters): DatePreset | null {
  if (!filters.date_from && !filters.date_to) return null;
  for (const p of ["this_month", "last_3_months", "this_year"] as const) {
    const dates = getPresetDates(p);
    if (dates && dates.date_from === filters.date_from && dates.date_to === filters.date_to) {
      return p;
    }
  }
  if (filters.date_from || filters.date_to) return "custom";
  return null;
}

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
  { value: "refund", label: "Refund" },
];

export const TransactionFiltersBar = ({ filters, onChange }: TransactionFiltersBarProps) => {
  const [searchValue, setSearchValue] = useState(filters.q ?? "");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset | null>(detectPreset(filters));
  const [presetOpen, setPresetOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: categories = [] } = useCategories();
  const { data: cards = [] } = useCards();

  useEffect(() => {
    setSearchValue(filters.q ?? "");
  }, [filters.q]);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ ...filters, q: value || undefined, page: 1 });
    }, 300);
  };

  const handlePresetSelect = (preset: DatePreset) => {
    setDatePreset(preset);
    setPresetOpen(false);
    if (preset === "custom") {
      onChange({ ...filters, page: 1 });
      return;
    }
    const dates = getPresetDates(preset);
    if (dates) onChange({ ...filters, ...dates, page: 1 });
  };

  const handleTypeToggle = (type: TransactionType) => {
    const current = filters.transaction_type ?? [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onChange({ ...filters, transaction_type: next.length ? next : undefined, page: 1 });
  };

  const handleCardToggle = (cardId: string) => {
    const current = filters.card_ids ?? [];
    const next = current.includes(cardId)
      ? current.filter((id) => id !== cardId)
      : [...current, cardId];
    onChange({ ...filters, card_ids: next.length ? next : undefined, page: 1 });
  };

  const handleCategoryToggle = (catId: string) => {
    const current = filters.category_ids ?? [];
    const next = current.includes(catId)
      ? current.filter((id) => id !== catId)
      : [...current, catId];
    onChange({ ...filters, category_ids: next.length ? next : undefined, page: 1 });
  };

  const removeFilter = (key: keyof TransactionFilters) => {
    const next = { ...filters };
    delete next[key];
    if (key === "date_from" || key === "date_to") {
      delete next.date_from;
      delete next.date_to;
      setDatePreset(null);
    }
    onChange({ ...next, page: 1 });
  };

  const clearAll = () => {
    setSearchValue("");
    setDatePreset(null);
    onChange({ page: 1, page_size: filters.page_size, sort_by: filters.sort_by, sort_order: filters.sort_order });
  };

  const activeFilterCount = [
    filters.q,
    filters.date_from || filters.date_to,
    filters.card_ids?.length,
    filters.category_ids?.length,
    filters.amount_min,
    filters.amount_max,
    filters.is_user_confirmed !== undefined,
    filters.source,
    filters.transaction_type?.length,
  ].filter(Boolean).length;

  const presetLabel =
    datePreset === "this_month"
      ? "This month"
      : datePreset === "last_3_months"
        ? "Last 3 months"
        : datePreset === "this_year"
          ? "This year"
          : datePreset === "custom"
            ? "Custom range"
            : "Date range";

  // Flatten categories for display
  const flatCategories: { id: string; label: string }[] = [];
  for (const cat of categories) {
    flatCategories.push({ id: cat.id, label: cat.name });
    for (const child of cat.children) {
      flatCategories.push({ id: child.id, label: `${cat.name} / ${child.name}` });
    }
  }
  flatCategories.unshift({ id: "__uncategorized__", label: "Uncategorized" });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions…"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
            aria-label="Search transactions"
          />
          {searchValue && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Date preset */}
        <Popover open={presetOpen} onOpenChange={setPresetOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={datePreset ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5"
            >
              {presetLabel}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            <div className="space-y-0.5">
              {(["this_month", "last_3_months", "this_year", "custom"] as DatePreset[]).map(
                (p) => (
                  <button
                    key={p}
                    onClick={() => handlePresetSelect(p)}
                    className={cn(
                      "w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      datePreset === p && "bg-accent",
                    )}
                  >
                    {p === "this_month"
                      ? "This month"
                      : p === "last_3_months"
                        ? "Last 3 months"
                        : p === "this_year"
                          ? "This year"
                          : "Custom range"}
                  </button>
                ),
              )}
              {datePreset && (
                <button
                  onClick={() => {
                    setDatePreset(null);
                    removeFilter("date_from");
                  }}
                  className="w-full rounded px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
                >
                  Clear
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Custom date inputs */}
        {datePreset === "custom" && (
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={filters.date_from ?? ""}
              onChange={(e) => onChange({ ...filters, date_from: e.target.value || undefined, page: 1 })}
              className="h-9 w-[140px] text-sm"
              aria-label="From date"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
              type="date"
              value={filters.date_to ?? ""}
              onChange={(e) => onChange({ ...filters, date_to: e.target.value || undefined, page: 1 })}
              className="h-9 w-[140px] text-sm"
              aria-label="To date"
            />
          </div>
        )}

        {/* Advanced filters */}
        <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-4 p-4" align="end">
            {/* Cards */}
            {cards.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Card
                </p>
                <div className="space-y-1.5">
                  {cards.map((card) => (
                    <label key={card.id} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={filters.card_ids?.includes(card.id) ?? false}
                        onCheckedChange={() => handleCardToggle(card.id)}
                        id={`card-${card.id}`}
                      />
                      <span className="text-sm">
                        {card.nickname} ••{card.last4}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Category
              </p>
              <Command className="rounded-md border">
                <CommandInput placeholder="Search categories…" className="h-8 text-xs" />
                <CommandList className="max-h-[140px]">
                  <CommandEmpty className="py-2 text-center text-xs">
                    No categories found.
                  </CommandEmpty>
                  <CommandGroup>
                    {flatCategories.map((cat) => (
                      <CommandItem
                        key={cat.id}
                        value={cat.label}
                        onSelect={() => handleCategoryToggle(cat.id)}
                        className="text-xs"
                      >
                        <Checkbox
                          checked={filters.category_ids?.includes(cat.id) ?? false}
                          className="mr-2"
                          aria-hidden
                        />
                        {cat.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            {/* Amount range */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Amount range
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.amount_min ?? ""}
                  onChange={(e) =>
                    onChange({ ...filters, amount_min: e.target.value || undefined, page: 1 })
                  }
                  className="h-8 text-sm"
                  aria-label="Minimum amount"
                />
                <span className="text-muted-foreground text-xs">–</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.amount_max ?? ""}
                  onChange={(e) =>
                    onChange({ ...filters, amount_max: e.target.value || undefined, page: 1 })
                  }
                  className="h-8 text-sm"
                  aria-label="Maximum amount"
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "All", value: undefined as boolean | undefined },
                  { label: "Confirmed", value: true },
                  { label: "Needs review", value: false },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() =>
                      onChange({ ...filters, is_user_confirmed: opt.value, page: 1 })
                    }
                    className={cn(
                      "rounded-full border px-3 py-0.5 text-xs transition-colors",
                      filters.is_user_confirmed === opt.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:border-primary/50",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Source
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "All", value: undefined as string | undefined },
                  { label: "Statement", value: "statement" },
                  { label: "Manual", value: "manual" },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() =>
                      onChange({
                        ...filters,
                        source: opt.value as TransactionFilters["source"],
                        page: 1,
                      })
                    }
                    className={cn(
                      "rounded-full border px-3 py-0.5 text-xs transition-colors",
                      filters.source === opt.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:border-primary/50",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction type */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Type
              </p>
              <div className="space-y-1.5">
                {TRANSACTION_TYPES.map((t) => (
                  <Label key={t.value} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={filters.transaction_type?.includes(t.value) ?? false}
                      onCheckedChange={() => handleTypeToggle(t.value)}
                      id={`type-${t.value}`}
                    />
                    <span className="text-sm">{t.label}</span>
                  </Label>
                ))}
              </div>
            </div>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => {
                  clearAll();
                  setAdvancedOpen(false);
                }}
              >
                Clear all filters
              </Button>
            )}
          </PopoverContent>
        </Popover>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Clear all
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.q && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Search: {filters.q}
              <button onClick={() => removeFilter("q")} aria-label="Remove search filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(filters.date_from || filters.date_to) && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {filters.date_from ?? "…"} – {filters.date_to ?? "…"}
              <button
                onClick={() => removeFilter("date_from")}
                aria-label="Remove date filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.amount_min && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Min ${filters.amount_min}
              <button onClick={() => removeFilter("amount_min")} aria-label="Remove min amount filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.amount_max && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Max ${filters.amount_max}
              <button onClick={() => removeFilter("amount_max")} aria-label="Remove max amount filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.source && (
            <Badge variant="secondary" className="gap-1 text-xs capitalize">
              {filters.source}
              <button onClick={() => removeFilter("source")} aria-label="Remove source filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.is_user_confirmed !== undefined && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {filters.is_user_confirmed ? "Confirmed" : "Needs review"}
              <button
                onClick={() => removeFilter("is_user_confirmed")}
                aria-label="Remove status filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.transaction_type?.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 text-xs capitalize">
              {t}
              <button
                onClick={() => {
                  const next = filters.transaction_type?.filter((x) => x !== t);
                  onChange({ ...filters, transaction_type: next?.length ? next : undefined, page: 1 });
                }}
                aria-label={`Remove ${t} type filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.card_ids?.map((id) => {
            const card = cards.find((c) => c.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 text-xs">
                {card ? `${card.nickname} ••${card.last4}` : id}
                <button
                  onClick={() => {
                    const next = filters.card_ids?.filter((x) => x !== id);
                    onChange({ ...filters, card_ids: next?.length ? next : undefined, page: 1 });
                  }}
                  aria-label="Remove card filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {filters.category_ids?.map((id) => {
            const cat = flatCategories.find((c) => c.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 text-xs">
                {cat ? cat.label : id}
                <button
                  onClick={() => {
                    const next = filters.category_ids?.filter((x) => x !== id);
                    onChange({
                      ...filters,
                      category_ids: next?.length ? next : undefined,
                      page: 1,
                    });
                  }}
                  aria-label="Remove category filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};
