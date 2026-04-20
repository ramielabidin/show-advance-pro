import { cn } from "@/lib/utils";
import Eyebrow from "@/components/Eyebrow";

interface PageTitleProps {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  subline?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageTitle({ title, eyebrow, subline, actions, className }: PageTitleProps) {
  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4", className)}>
      <div className="min-w-0 md:flex-1">
        {eyebrow && <Eyebrow className="mb-0.5">{eyebrow}</Eyebrow>}
        <h1 className="text-2xl sm:text-3xl tracking-tight text-foreground">{title}</h1>
        {subline && <div className="text-sm text-muted-foreground mt-0.5 sm:mt-1">{subline}</div>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 self-end md:self-auto md:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
