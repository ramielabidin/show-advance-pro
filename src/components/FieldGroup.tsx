import { cn } from "@/lib/utils";

interface FieldGroupProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  incomplete?: boolean;
}

export default function FieldGroup({ title, children, className, contentClassName, incomplete }: FieldGroupProps) {
  return (
    <div className={className}>
      <div className="border-l border-border pl-2.5 mb-4">
        <h3 className="label-smaller flex items-center gap-1.5">
          {title.toLowerCase()}
          {incomplete && <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />}
        </h3>
      </div>
      <div className={cn("space-y-3", contentClassName)}>{children}</div>
    </div>
  );
}
