interface EmptyFieldPromptProps {
  label: string;
  onClick: () => void;
}

export default function EmptyFieldPrompt({ label, onClick }: EmptyFieldPromptProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 w-full text-left group py-0.5"
    >
      <span className="text-sm text-muted-foreground/60 italic group-hover:text-muted-foreground transition-colors">
        Tap to add {label.toLowerCase()}
      </span>
    </button>
  );
}
