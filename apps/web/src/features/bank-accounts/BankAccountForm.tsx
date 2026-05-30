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
import type { BankAccount, BankAccountCreate, AccountType } from "./bankAccountsApi";

const PRESET_COLORS = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Red", value: "#ef4444" },
  { label: "Green", value: "#22c55e" },
  { label: "Purple", value: "#a855f7" },
  { label: "Orange", value: "#f97316" },
  { label: "Teal", value: "#14b8a6" },
] as const;

const ACCOUNT_TYPES: { label: string; value: AccountType }[] = [
  { label: "Checking", value: "checking" },
  { label: "Savings", value: "savings" },
  { label: "Money Market", value: "money_market" },
  { label: "Other", value: "other" },
];

const bankAccountFormSchema = z.object({
  nickname: z.string().min(1, "Nickname is required"),
  institution: z.string().min(1, "Institution is required"),
  account_type: z.enum(["checking", "savings", "money_market", "other"]),
  last4: z
    .string()
    .optional()
    .refine(
      (val) => val === undefined || val === "" || /^\d{4}$/.test(val),
      "Must be 4 numeric digits"
    ),
  color: z.string().optional(),
  is_shared: z.boolean(),
});

type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>;

interface BankAccountFormProps {
  defaultValues?: BankAccount;
  onSubmit: (data: BankAccountCreate) => void;
  isPending: boolean;
  submitLabel?: string;
}

export const BankAccountForm = ({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel = "Save",
}: BankAccountFormProps) => {
  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: {
      nickname: defaultValues?.nickname ?? "",
      institution: defaultValues?.institution ?? "",
      account_type: defaultValues?.account_type ?? "checking",
      last4: defaultValues?.last4 ?? "",
      color: defaultValues?.color ?? PRESET_COLORS[0].value,
      is_shared: defaultValues?.is_shared ?? true,
    },
  });

  function handleSubmit(values: BankAccountFormValues) {
    const payload: BankAccountCreate = {
      nickname: values.nickname,
      institution: values.institution,
      account_type: values.account_type,
      last4: values.last4 === "" ? undefined : values.last4,
      color: values.color,
      is_shared: values.is_shared,
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
                  <Input placeholder="My Checking Account" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="institution"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Institution</FormLabel>
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
            name="account_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger aria-label="Account type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="last4"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last 4 digits (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="1234"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Last 4 digits of account number</p>
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
              <div className="flex flex-wrap gap-2" role="group" aria-label="Account color">
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
                  <label htmlFor="bank-account-custom-color" className="sr-only">
                    Custom color
                  </label>
                  <input
                    id="bank-account-custom-color"
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

        <div className="space-y-3">
          <Controller
            control={form.control}
            name="is_shared"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bank_account_is_shared"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <Label htmlFor="bank_account_is_shared" className="cursor-pointer">
                  Shared with household
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
