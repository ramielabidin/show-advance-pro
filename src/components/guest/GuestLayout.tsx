interface GuestLayoutProps {
  children: React.ReactNode;
}

export default function GuestLayout({ children }: GuestLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-5 sm:px-8 pt-6">
        <p className="font-display text-xl tracking-[-0.02em] text-foreground">Advance</p>
      </header>
      <main className="px-5 sm:px-8 pt-8 pb-20 animate-fade-in">
        <div className="mx-auto w-full max-w-[720px]">{children}</div>
      </main>
      <footer className="px-5 sm:px-8 pb-8">
        <p className="mx-auto w-full max-w-[720px] text-[11px] uppercase tracking-widest text-muted-foreground/70 font-medium">
          Powered by Advance
        </p>
      </footer>
    </div>
  );
}
