import { useState } from "react";
import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { register, getMe } from "@/features/auth/authApi";
import { useAuthStore } from "@/stores/auth";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/signup")({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (useAuthStore.getState().accessToken) {
      throw redirect({ to: "/secure/dashboard" });
    }
  },
  component: SignupPage,
});

const signupSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

function SignupPage() {
  const router = useRouter();
  const { token } = Route.useSearch();
  const { setAuth } = useAuthStore();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: SignupFormValues) => {
      const tokenRes = await register(values.email, values.password);
      const user = await getMe();
      return { token: tokenRes.access_token, user };
    },
    onSuccess: async ({ token: accessToken, user }) => {
      setAuth(accessToken, user);
      if (token) {
        await router.navigate({
          to: "/secure/join-household",
          search: { token },
        });
      } else {
        await router.navigate({ to: "/secure/dashboard" });
      }
    },
    onError: (err: unknown) => {
      const status = getHttpStatus(err);
      if (status === 409 || status === 400) {
        setFormError("An account with this email already exists");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  function onSubmit(values: SignupFormValues) {
    setFormError(null);
    mutation.mutate(values);
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </Form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              search={token ? { token } : undefined}
              className="text-primary underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function getHttpStatus(err: unknown): number | null {
  if (
    err !== null &&
    typeof err === "object" &&
    "response" in err &&
    err.response !== null &&
    typeof err.response === "object" &&
    "status" in err.response &&
    typeof err.response.status === "number"
  ) {
    return err.response.status;
  }
  return null;
}
