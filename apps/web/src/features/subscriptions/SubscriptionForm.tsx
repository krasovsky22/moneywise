import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type { SubscriptionCreate, SubscriptionFrequency } from "./subscriptionsApi";

const FREQUENCIES: { label: string; value: SubscriptionFrequency }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Yearly", value: "yearly" },
];

const subscriptionFormSchema = z.object({
  merchant_clean: z.string().min(1, "Merchant is required"),
  amount_typical: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, "Must be a positive amount"),
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  next_expected_charge_date: z.string().optional(),
  notes: z.string().optional(),
});

type SubscriptionFormValues = z.infer<typeof subscriptionFormSchema>;

interface SubscriptionFormProps {
  onSubmit: (data: SubscriptionCreate) => void;
  isPending: boolean;
  submitLabel?: string;
}

export const SubscriptionForm = ({
  onSubmit,
  isPending,
  submitLabel = "Add subscription",
}: SubscriptionFormProps) => {
  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: {
      merchant_clean: "",
      amount_typical: "",
      frequency: "monthly",
      next_expected_charge_date: "",
      notes: "",
    },
  });

  function handleSubmit(values: SubscriptionFormValues) {
    onSubmit({
      merchant_clean: values.merchant_clean,
      amount_typical: values.amount_typical,
      frequency: values.frequency,
      next_expected_charge_date:
        values.next_expected_charge_date === ""
          ? undefined
          : values.next_expected_charge_date,
      notes: values.notes === "" ? undefined : values.notes,
    });
  }

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
            name="merchant_clean"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Merchant</FormLabel>
                <FormControl>
                  <Input placeholder="Netflix" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount_typical"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input placeholder="15.99" inputMode="decimal" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequency</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger aria-label="Frequency">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
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
            name="next_expected_charge_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Next charge (optional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Cancel by emailing support@..., or a cancellation URL"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
};
