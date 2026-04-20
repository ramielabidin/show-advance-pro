import Eyebrow from "@/components/Eyebrow";

interface PageTitleProps {
  children: React.ReactNode;
  eyebrow?: React.ReactNode;
  subline?: React.ReactNode;
}

export default function PageTitle({ children, eyebrow, subline }: PageTitleProps) {
  return (
    <div>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="text-2xl sm:text-3xl font-medium tracking-tight leading-[1.1] text-foreground m-0">
        {children}
      </h1>
      {subline && (
        <p className="text-sm text-muted-foreground mt-1.5">{subline}</p>
      )}
    </div>
  );
}
