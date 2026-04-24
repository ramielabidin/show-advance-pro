import { useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { UnderlineInput } from "@/components/ui/underline-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ──

type InviteResolution =
  | {
      status: "valid";
      team: { displayName: string };
      inviter: { name: string };
      email: string;
      roleLabel: string;
      expiresAt: string;
    }
  | { status: "expired" }
  | { status: "not_found" };

// ── Shared bits ──

function Wordmark() {
  return (
    <div className="mb-11 flex items-center gap-2.5">
      <div className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-foreground font-display text-[15px] leading-none text-background">
        A
      </div>
      <div className="font-display text-[18px] tracking-[-0.02em] text-foreground">Advance</div>
    </div>
  );
}

function SlugLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  );
}

function DashRule() {
  return <div className="my-[22px] mt-7 h-0.5 w-7 bg-foreground" />;
}

function DataBlock({
  rows,
}: {
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="mt-[30px] border-y border-foreground">
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={`flex py-3.5 ${i > 0 ? "border-t border-border" : ""}`}
        >
          <div className="w-[38%] pt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:w-[38%] max-sm:w-[42%]">
            {row.label}
          </div>
          <div className="flex-1 text-sm leading-[1.4] text-foreground">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

function SignOff({ token, children }: { token: string; children: React.ReactNode }) {
  return (
    <div className="mt-14 font-mono text-[11px] leading-[1.7] text-muted-foreground">
      — Advance · advancetouring.com/invite/{token.slice(0, 6)}
      <br />
      {children}
    </div>
  );
}

function PillButton({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-[26px] bg-foreground px-7 py-[17px] text-[15px] font-medium leading-none text-background transition-transform duration-150 [transition-timing-function:var(--ease-out)] hover:-translate-y-px active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {children}
    </button>
  );
}

const GoogleGlyph = () => (
  <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
    />
    <path
      fill="#FBBC05"
      d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
    />
  </svg>
);

// ── Page ──

export default function InvitePage() {
  const { token = "" } = useParams<{ token: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ssoReturn = searchParams.get("sso") === "1";

  // Force light mode on this page — it's a visual continuation of the
  // warm-light Dispatch invite email, and the app's dark-mode default
  // would break that continuity. We mutate the root class directly rather
  // than touching next-themes' stored preference so the user's normal
  // theme choice is restored when they leave the page.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => {
      if (hadDark) root.classList.add("dark");
    };
  }, []);

  const { data: resolution, isLoading } = useQuery<InviteResolution>({
    queryKey: ["resolve-team-invite", token],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<InviteResolution>(
        "resolve-team-invite",
        { body: { token } },
      );
      if (error) throw error;
      if (!data) throw new Error("Empty response");
      return data;
    },
    enabled: !!token,
    retry: false,
    staleTime: 60_000,
  });

  if (!token) return <ErrorShell title="Link not found." lede="This invite link is missing its token." />;
  if (authLoading || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!resolution || resolution.status === "not_found") {
    return <ErrorShell title="Link not found." lede="This invite doesn't exist, or the link has been revoked." />;
  }
  if (resolution.status === "expired") {
    return (
      <ErrorShell
        title="Invite expired."
        lede="This invite is past its 14-day window. Ask the person who invited you to send a new one."
      />
    );
  }

  const signedIn = !!session;
  const signedInEmail = session?.user?.email?.toLowerCase() ?? "";
  const invitedEmail = resolution.email.toLowerCase();
  const emailsMatch = signedIn && signedInEmail === invitedEmail;

  return (
    <main className="min-h-screen bg-background px-6 pb-20 pt-12 animate-fade-in">
      <div className="mx-auto w-full max-w-[520px]">
        <Wordmark />
        <SlugLine>
          — — — Accepting {firstName(resolution.inviter.name)}'s invite — — —
        </SlugLine>
        {signedIn ? (
          <ExistingUserConfirm
            token={token}
            resolution={resolution}
            signedInEmail={session!.user!.email ?? ""}
            signedInName={
              (session!.user!.user_metadata?.full_name as string | undefined) ??
              session!.user!.email ??
              ""
            }
            emailsMatch={emailsMatch}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ["user-teams"] });
              navigate("/");
            }}
          />
        ) : (
          <NewUserAcceptForm
            token={token}
            resolution={resolution}
            ssoReturn={ssoReturn}
            clearSsoParam={() => {
              searchParams.delete("sso");
              setSearchParams(searchParams, { replace: true });
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ["user-teams"] });
              navigate("/");
            }}
          />
        )}
      </div>
    </main>
  );
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || full;
}

// ── Error shell (expired / not found) ──

function ErrorShell({ title, lede }: { title: string; lede: string }) {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-background px-6 pb-20 pt-12 animate-fade-in">
      <div className="mx-auto w-full max-w-[520px]">
        <Wordmark />
        <SlugLine>— — — Invite — — —</SlugLine>
        <h1 className="m-0 font-display text-[54px] font-normal leading-none tracking-[-0.035em] text-foreground max-sm:text-[42px]">
          {title}
        </h1>
        <DashRule />
        <p className="m-0 max-w-[460px] text-base leading-[1.6] text-foreground/80">{lede}</p>
        <div className="mt-8">
          <PillButton onClick={() => navigate("/")}>Back to Advance&nbsp;→</PillButton>
        </div>
      </div>
    </main>
  );
}

// ── New user (no session): SSO or set a password ──

function NewUserAcceptForm({
  token,
  resolution,
  ssoReturn,
  clearSsoParam,
  onSuccess,
}: {
  token: string;
  resolution: Extract<InviteResolution, { status: "valid" }>;
  ssoReturn: boolean;
  clearSsoParam: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const accept = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        success?: boolean;
        error?: string;
        code?: string;
      }>("accept-team-invite", { body: { token, name: name.trim(), password } });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error ?? "Failed to accept invite");
    },
    onSuccess: async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: resolution.email,
        password,
      });
      if (signInError) {
        toast.error(signInError.message);
        return;
      }
      toast.success("Welcome to the crew");
      await onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const returnUrl = `${window.location.origin}/invite/${token}?sso=1`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: returnUrl },
      });
      if (error) throw error;
    } catch (err) {
      setGoogleLoading(false);
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    }
  };

  // If the user returns from Google OAuth on this page without a session,
  // something went wrong in the popup. Clear the flag and show a toast.
  useEffect(() => {
    if (ssoReturn) {
      toast.error("Google sign-in didn't complete. Try again.");
      clearSsoParam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = () => {
    let ok = true;
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
      setNameError("Enter your full name.");
      ok = false;
    } else setNameError(null);
    if (password.length < 10) {
      setPasswordError("At least 10 characters.");
      ok = false;
    } else setPasswordError(null);
    return ok;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    accept.mutate();
  };

  return (
    <>
      <h1 className="m-0 font-display text-[54px] font-normal leading-none tracking-[-0.035em] text-foreground max-sm:text-[42px]">
        You're in.
        <br />
        Set up
        <br />
        your account.
      </h1>
      <DashRule />
      <p className="m-0 max-w-[460px] text-base leading-[1.6] text-foreground/80">
        <strong className="font-semibold">{resolution.inviter.name}</strong> invited you to join{" "}
        <strong className="font-semibold">{resolution.team.displayName}</strong> on Advance. Pick a
        name and password and you'll show up on their crew.
      </p>

      <DataBlock
        rows={[
          { label: "Team", value: resolution.team.displayName },
          { label: "Invited by", value: resolution.inviter.name },
          { label: "Your role", value: resolution.roleLabel },
        ]}
      />

      <div className="mt-9">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          — Finish your account
        </div>
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || accept.isPending}
          className="inline-flex w-full max-w-[380px] items-center gap-3 rounded-[26px] border border-border bg-card px-[22px] py-[15px] text-[15px] font-medium text-foreground transition-[transform,border-color] duration-150 [transition-timing-function:var(--ease-out)] hover:-translate-y-px hover:border-foreground active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {googleLoading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <GoogleGlyph />}
          <span>{googleLoading ? "Opening Google…" : "Continue with Google"}</span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Matches invite
          </span>
        </button>
        <p className="mt-2 max-w-[380px] text-xs leading-[1.5] text-muted-foreground">
          Use the Google account for{" "}
          <span className="font-mono text-foreground">{resolution.email}</span> — the address you
          were invited at. Picking a different one? We'll ask you to confirm before joining the
          crew.
        </p>
      </div>

      <div className="my-9 flex items-center gap-3.5">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          or set a password
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="relative">
          <label
            htmlFor="invite-email"
            className="mb-2 block text-[13px] font-medium text-foreground"
          >
            Email
          </label>
          <UnderlineInput
            id="invite-email"
            type="email"
            value={resolution.email}
            readOnly
            className="font-mono !text-[14px] !text-muted-foreground"
          />
          <span className="absolute right-0 top-9 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Locked
          </span>
        </div>

        <div>
          <label
            htmlFor="invite-name"
            className="mb-2 block text-[13px] font-medium text-foreground"
          >
            Full name
          </label>
          <UnderlineInput
            id="invite-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(null);
            }}
            placeholder="Jordan Reyes"
            disabled={accept.isPending}
          />
          {nameError && (
            <p className="mt-1.5 text-xs text-destructive">{nameError}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="invite-password"
            className="mb-2 block text-[13px] font-medium text-foreground"
          >
            Password
          </label>
          <UnderlineInput
            id="invite-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(null);
            }}
            placeholder="At least 10 characters"
            disabled={accept.isPending}
          />
          <p className="mt-1.5 text-xs leading-[1.4] text-muted-foreground">
            10 characters or more. You'll use this to sign in next time.
          </p>
          {passwordError && (
            <p className="mt-1.5 text-xs text-destructive">{passwordError}</p>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-[18px]">
          <PillButton type="submit" disabled={accept.isPending}>
            {accept.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining…
              </>
            ) : (
              <>Join the crew&nbsp;→</>
            )}
          </PillButton>
          <div className="text-[13px] text-muted-foreground">
            Already on Advance?{" "}
            <a
              href="/auth"
              className="border-b border-border pb-px text-foreground transition-colors hover:border-foreground"
            >
              Sign in instead
            </a>
          </div>
        </div>
      </form>

      <SignOff token={token}>
        — By joining, you agree to the{" "}
        <a href="/terms" className="border-b border-border pb-px">
          terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="border-b border-border pb-px">
          privacy notice
        </a>
        .
      </SignOff>
    </>
  );
}

// ── Existing user (session present): one-click accept ──

function ExistingUserConfirm({
  token,
  resolution,
  signedInEmail,
  signedInName,
  emailsMatch,
  onSuccess,
}: {
  token: string;
  resolution: Extract<InviteResolution, { status: "valid" }>;
  signedInEmail: string;
  signedInName: string;
  emailsMatch: boolean;
  onSuccess: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [mismatchOpen, setMismatchOpen] = useState(false);

  const acceptFn = async (confirmMismatch: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : undefined;
    const { data, error } = await supabase.functions.invoke<{
      success?: boolean;
      error?: string;
      invitedEmail?: string;
    }>("accept-team-invite", {
      body: { token, confirmMismatch },
      headers: authHeader ? { Authorization: authHeader } : undefined,
    });
    if (error) throw new Error(error.message);
    if (data?.error === "email_mismatch") throw new Error("email_mismatch");
    if (!data?.success) throw new Error(data?.error ?? "Failed to accept invite");
  };

  const accept = useMutation({
    mutationFn: () => acceptFn(false),
    onSuccess: async () => {
      toast.success(`Joined ${resolution.team.displayName}`);
      await onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const acceptConfirmed = useMutation({
    mutationFn: () => acceptFn(true),
    onSuccess: async () => {
      setMismatchOpen(false);
      toast.success(`Joined ${resolution.team.displayName}`);
      await onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const decline = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string }>(
        "decline-team-invite",
        { body: { token } },
      );
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error ?? "Failed to decline");
    },
    onSuccess: () => {
      toast.success("Invite declined");
      navigate("/");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const switchAccount = async () => {
    await supabase.auth.signOut();
    // Stay on the same page — re-renders as NewUserAcceptForm since session is gone.
    window.location.reload();
  };

  const handleAccept = () => {
    if (emailsMatch) accept.mutate();
    else setMismatchOpen(true);
  };

  const initial = (signedInName.trim()[0] ?? signedInEmail[0] ?? "A").toUpperCase();

  return (
    <>
      <h1 className="m-0 font-display text-[54px] font-normal leading-none tracking-[-0.035em] text-foreground max-sm:text-[42px]">
        Almost
        <br />
        there.
      </h1>
      <DashRule />
      <p className="m-0 max-w-[460px] text-base leading-[1.6] text-foreground/80">
        <strong className="font-semibold">{resolution.inviter.name}</strong> invited you to join{" "}
        <strong className="font-semibold">{resolution.team.displayName}</strong>. One click and
        you'll show up on their crew — no new account needed.
      </p>

      <DataBlock
        rows={[
          { label: "Team", value: resolution.team.displayName },
          { label: "Invited by", value: resolution.inviter.name },
          { label: "Your role", value: resolution.roleLabel },
        ]}
      />

      <div className="mt-[30px] flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full font-display text-[16px]"
          style={{
            background: "hsl(var(--pastel-green-bg))",
            color: "hsl(var(--pastel-green-fg))",
          }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Joining as
          </div>
          <div className="truncate text-sm text-foreground">
            {signedInName ? signedInName : signedInEmail}
            {signedInName ? (
              <>
                {" · "}
                <span className="font-mono text-[13px] text-muted-foreground">{signedInEmail}</span>
              </>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={switchAccount}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground border-b border-border pb-px"
        >
          Switch
        </button>
      </div>

      {!emailsMatch && (
        <p className="mt-3 text-xs leading-[1.5] text-destructive">
          You're signed in as a different email than the one invited (
          <span className="font-mono">{resolution.email}</span>). Switch accounts, or accept and
          we'll add this one to the crew.
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-[18px]">
        <PillButton onClick={handleAccept} disabled={accept.isPending}>
          {accept.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Accepting…
            </>
          ) : (
            <>Accept invite&nbsp;→</>
          )}
        </PillButton>
        <button
          type="button"
          onClick={() => decline.mutate()}
          disabled={decline.isPending}
          className="text-[13px] text-muted-foreground border-b border-border pb-px transition-colors hover:text-foreground disabled:opacity-60"
        >
          {decline.isPending ? "Declining…" : "Decline"}
        </button>
      </div>

      <SignOff token={token}>
        — Not expecting this? Decline; {firstName(resolution.inviter.name)} won't be notified.
      </SignOff>

      <Dialog open={mismatchOpen} onOpenChange={setMismatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Different email — continue?</DialogTitle>
            <DialogDescription>
              You're signed in as{" "}
              <span className="font-mono text-foreground">{signedInEmail}</span>, but the invite
              was sent to{" "}
              <span className="font-mono text-foreground">{resolution.email}</span>. Accepting
              will add this account to {resolution.team.displayName}'s crew.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setMismatchOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Pick another
            </button>
            <PillButton
              onClick={() => acceptConfirmed.mutate()}
              disabled={acceptConfirmed.isPending}
            >
              {acceptConfirmed.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting…
                </>
              ) : (
                <>Use this account</>
              )}
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
