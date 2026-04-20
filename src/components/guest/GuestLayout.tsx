interface GuestLayoutProps {
  children: React.ReactNode;
}

export default function GuestLayout({ children }: GuestLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <header className="px-4 sm:px-8 pt-6">
        <p className="font-display text-xl tracking-[-0.02em] text-foreground">Advance</p>
      </header>
      <main className="px-4 sm:px-8 pt-8 pb-20 animate-fade-in">
        <div className="mx-auto w-full max-w-[880px] min-w-0">{children}</div>
      </main>
      <footer className="px-4 sm:px-8 pb-8">
        <p className="mx-auto w-full max-w-[880px] text-[11px] uppercase tracking-widest text-muted-foreground/70 font-medium">
          Powered by Advance
        </p>
      </footer>
    </div>
  );
}
