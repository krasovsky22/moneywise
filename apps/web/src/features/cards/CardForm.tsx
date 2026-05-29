import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { Card, CardCreate, CardNetwork } from "./cardsApi";

const PRESET_COLORS = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Red", value: "#ef4444" },
  { label: "Green", value: "#22c55e" },
  { label: "Purple", value: "#a855f7" },
  { label: "Orange", value: "#f97316" },
  { label: "Teal", value: "#14b8a6" },
] as const;

const NETWORKS: { label: string; value: CardNetwork }[] = [
  { label: "Visa", value: "visa" },
  { label: "Mastercard", value: "mastercard" },
  { label: "Amex", value: "amex" },
  { label: "Discover", value: "discover" },
  { label: "Other", value: "other" },
];

const cardFormSchema = z.object({
  nickname: z.string().min(1, "Nickname is required"),
  issuer: z.string().min(1, "Issuer is required"),
  last4: z
    .string()
    .length(4, "Must be exactly 4 digits")
    .regex(/^\d{4}$/, "Must be 4 numeric digits"),
  network: z
    .enum(["visa", "mastercard", "amex", "discover", "other"])
    .optional(),
  color: z.string().optional(),
  statement_close_day: z
    .number({ invalid_type_error: "Required" })
    .int()
    .min(1, "Must be between 1 and 31")
    .max(31, "Must be between 1 and 31"),
  payment_due_day: z
    .number({ invalid_type_error: "Required" })
    .int()
    .min(1, "Must be between 1 and 31")
    .max(31, "Must be between 1 and 31"),
  minimum_payment_dollars: z
    .string()
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  is_shared: z.boolean(),
  is_default: z.boolean(),
});

type CardFormValues = z.infer<typeof cardFormSchema>;

interface CardFormProps {
  defaultValues?: Card;
  onSubmit: (data: CardCreate) => void;
  isPending: boolean;
  submitLabel?: string;
}

export const CardForm = ({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel = "Save",
}: CardFormProps) => {
  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: {
      nickname: defaultValues?.nickname ?? "",
      issuer: defaultValues?.issuer ?? "",
      last4: defaultValues?.last4 ?? "",
      network: defaultValues?.network ?? undefined,
      color: defaultValues?.color ?? PRESET_COLORS[0].value,
      statement_close_day: defaultValues?.statement_close_day ?? (undefined as unknown as number),
      payment_due_day: defaultValues?.payment_due_day ?? (undefined as unknown as number),
      minimum_payment_dollars:
        defaultValues?.minimum_payment_cents != null
          ? String(defaultValues.minimum_payment_cents / 100)
          : "",
      is_shared: defaultValues?.is_shared ?? true,
      is_default: defaultValues?.is_default ?? false,
    },
  });

  function handleSubmit(values: CardFormValues) {
    const minPaymentCents =
      values.minimum_payment_dollars != null &&
      values.minimum_payment_dollars !== ""
        ? Math.round(parseFloat(values.minimum_payment_dollars) * 100)
        : undefined;

    const payload: CardCreate = {
      nickname: values.nickname,
      issuer: values.issuer,
      last4: values.last4,
      network: values.network,
      color: values.color,
      statement_close_day: values.statement_close_day,
      payment_due_day: values.payment_due_day,
      minimum_payment_cents: minPaymentCents,
      is_shared: values.is_shared,
      is_default: values.is_default,
    };

    onSubmit(payload);
  }

  const selectedColor = form.watch("color");

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-5"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nickname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nickname</FormLabel>
                <FormControl>
                  <Input placeholder="My Chase Sapphire" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="issuer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issuer</FormLabel>
                <FormControl>
                  <Input placeholder="Chase" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="last4"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last 4 digits</FormLabel>
                <FormControl>
                  <Input
                    placeholder="1234"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="network"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Network</FormLabel>
                <Select
                  value={field.value ?? ""}
                  onValueChange={(val) =>
                    field.onChange(val === "" ? undefined : val)
                  }
                >
                  <FormControl>
                    <SelectTrigger aria-label="Card network">
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {NETWORKS.map((n) => (
                      <SelectItem key={n.value} value={n.value}>
                        {n.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Color swatches */}
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Card color">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    aria-label={preset.label}
                    aria-pressed={selectedColor === preset.value}
                    onClick={() => field.onChange(preset.value)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      selectedColor === preset.value
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: preset.value }}
                  />
                ))}
                <div className="flex items-center gap-1.5">
                  <label htmlFor="custom-color" className="sr-only">
                    Custom color
                  </label>
                  <input
                    id="custom-color"
                    type="color"
                    value={selectedColor ?? "#000000"}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded-full border border-input bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full"
                    aria-label="Custom color"
                  />
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="statement_close_day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Statement closes on</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="28"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="payment_due_day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment due on</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="15"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  If due day is before close day, we assume the next calendar
                  month.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="minimum_payment_dollars"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Minimum payment (optional)</FormLabel>
              <div className="relative">
                <span
                  className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
                  aria-hidden="true"
                >
                  $
                </span>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="25.00"
                    className="pl-6"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <Controller
            control={form.control}
            name="is_shared"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_shared"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <Label htmlFor="is_shared" className="cursor-pointer">
                  Shared card (visible to all household members)
                </Label>
              </div>
            )}
          />

          <Controller
            control={form.control}
            name="is_default"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_default"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <Label htmlFor="is_default" className="cursor-pointer">
                  Set as default card
                </Label>
              </div>
            )}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
};
