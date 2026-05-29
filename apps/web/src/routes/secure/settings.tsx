import { useState, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { changePassword } from "@/features/auth/authApi";
import { useAuthStore } from "@/stores/auth";
import {
  getHousehold,
  getMembers,
  getInvitations,
  updateHouseholdName,
  createInvitation,
  revokeInvitation,
  leaveHousehold,
} from "@/features/household/householdApi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/secure/settings")({
  component: SettingsPage,
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      setPasswordError(null);
      setPasswordSuccess(true);
      form.reset();
    },
    onError: (err: unknown) => {
      const status = getHttpStatus(err);
      if (status === 401 || status === 400) {
        setPasswordError("Current password is incorrect");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  function onSubmit(values: ChangePasswordFormValues) {
    setPasswordError(null);
    setPasswordSuccess(false);
    mutation.mutate(values);
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">Email</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
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
                name="confirmNewPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
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

              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-green-600">
                  Password changed successfully
                </p>
              )}

              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Change Password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Household Card */}
      <HouseholdCard currentUserId={user?.id ?? null} />

    </main>
  );
}

interface HouseholdCardProps {
  currentUserId: string | null;
}

function HouseholdCard({ currentUserId }: HouseholdCardProps) {
  const queryClient = useQueryClient();

  const {
    data: household,
    isLoading: householdLoading,
    isError: householdError,
  } = useQuery({ queryKey: ["household"], queryFn: getHousehold });

  const {
    data: members,
    isLoading: membersLoading,
    isError: membersError,
  } = useQuery({ queryKey: ["household-members"], queryFn: getMembers });

  const {
    data: invitations,
    isLoading: invitationsLoading,
    isError: invitationsError,
  } = useQuery({
    queryKey: ["household-invitations"],
    queryFn: getInvitations,
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (household) {
      setNameValue(household.name);
    }
  }, [household]);

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingName]);

  const updateNameMutation = useMutation({
    mutationFn: (name: string) => updateHouseholdName(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["household"] });
      setIsEditingName(false);
    },
    onError: () => {
      toast.error("Failed to update household name.");
      setIsEditingName(false);
    },
  });

  function commitNameEdit() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === household?.name) {
      setIsEditingName(false);
      if (household) setNameValue(household.name);
      return;
    }
    updateNameMutation.mutate(trimmed);
  }

  function cancelNameEdit() {
    setIsEditingName(false);
    if (household) setNameValue(household.name);
  }

  const [inviteEmail, setInviteEmail] = useState("");
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteMutation = useMutation({
    mutationFn: (email: string) => createInvitation(email),
    onSuccess: (data) => {
      setNewInviteUrl(data.invite_url);
      setInviteEmail("");
      void queryClient.invalidateQueries({ queryKey: ["household-invitations"] });
    },
    onError: () => {
      toast.error("Failed to send invitation.");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["household-invitations"] });
    },
    onError: () => {
      toast.error("Failed to revoke invitation.");
    },
  });

  const leaveMutation = useMutation({
    mutationFn: leaveHousehold,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["household"] });
      void queryClient.invalidateQueries({ queryKey: ["household-members"] });
      void queryClient.invalidateQueries({
        queryKey: ["household-invitations"],
      });
      toast.success("You've left the household.");
    },
    onError: () => {
      toast.error("Failed to leave household.");
    },
  });

  function handleLeave() {
    if (
      window.confirm(
        "Are you sure you want to leave this household? You will be placed in a new empty household."
      )
    ) {
      leaveMutation.mutate();
    }
  }

  async function handleCopy() {
    if (!newInviteUrl) return;
    try {
      await navigator.clipboard.writeText(newInviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  const pendingInvitations = invitations?.filter((inv) => inv.status === "pending") ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Household</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Household name */}
        <div className="space-y-1">
          <p className="text-sm font-medium leading-none">Name</p>
          {householdLoading ? (
            <div className="h-5 w-40 rounded bg-muted animate-pulse" />
          ) : householdError ? (
            <p className="text-sm text-destructive">Failed to load household</p>
          ) : isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitNameEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitNameEdit();
                  if (e.key === "Escape") cancelNameEdit();
                }}
                className="h-8 max-w-xs"
                disabled={updateNameMutation.isPending}
                aria-label="Household name"
              />
              <span className="text-xs text-muted-foreground">
                Enter to save, Esc to cancel
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">{household?.name}</p>
              <button
                onClick={() => setIsEditingName(true)}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Edit household name"
              >
                <PencilIcon />
              </button>
            </div>
          )}
        </div>

        {/* Members list */}
        <div className="space-y-2">
          <p className="text-sm font-medium leading-none">Members</p>
          {membersLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-10 rounded bg-muted animate-pulse"
                />
              ))}
            </div>
          ) : membersError ? (
            <p className="text-sm text-destructive">Failed to load members</p>
          ) : (
            <ul className="space-y-2">
              {(members ?? []).map((member) => {
                const isCurrentUser = member.user_id === currentUserId;
                const label = member.display_name ?? member.email;
                const initials = getInitials(member.display_name, member.email);
                return (
                  <li
                    key={member.user_id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                        aria-hidden="true"
                      >
                        {initials}
                      </div>
                      <span className="text-sm">{label}</span>
                      {isCurrentUser && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          You
                        </span>
                      )}
                    </div>
                    {isCurrentUser && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={handleLeave}
                        disabled={leaveMutation.isPending}
                        aria-label="Leave household"
                      >
                        {leaveMutation.isPending ? "Leaving…" : "Leave"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Invite form */}
        <div className="space-y-3">
          <p className="text-sm font-medium leading-none">Invite someone</p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inviteEmail.trim()) {
                  inviteMutation.mutate(inviteEmail.trim());
                }
              }}
              className="max-w-xs"
              aria-label="Email to invite"
              disabled={inviteMutation.isPending}
            />
            <Button
              size="sm"
              disabled={inviteMutation.isPending || !inviteEmail.trim()}
              onClick={() => {
                if (inviteEmail.trim()) {
                  inviteMutation.mutate(inviteEmail.trim());
                }
              }}
            >
              {inviteMutation.isPending ? "Inviting…" : "Invite"}
            </Button>
          </div>

          {newInviteUrl && (
            <div className="rounded-md border bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium">Invitation link created</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                  {newInviteUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void handleCopy();
                  }}
                  aria-label="Copy invitation link"
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link — it expires in 7 days.
              </p>
            </div>
          )}
        </div>

        {/* Pending invitations */}
        {!invitationsLoading && !invitationsError && pendingInvitations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Pending invitations</p>
            <ul className="space-y-2">
              {pendingInvitations.map((inv) => (
                <li
                  key={inv.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDate(inv.expires_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => revokeMutation.mutate(inv.id)}
                    disabled={revokeMutation.isPending}
                    aria-label={`Revoke invitation for ${inv.email}`}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {invitationsError && (
          <p className="text-sm text-destructive">Failed to load invitations</p>
        )}
      </CardContent>
    </Card>
  );
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function getInitials(displayName: string | null, email: string): string {
  const source = displayName ?? email;
  const parts = source.split(/[\s@]/);
  const a = parts[0];
  const b = parts[1];
  if (a && b && a.length > 0 && b.length > 0) {
    return (a.charAt(0) + b.charAt(0)).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
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
