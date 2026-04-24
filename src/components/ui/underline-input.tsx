import * as React from "react";

import { cn } from "@/lib/utils";

// Underline-only input variant used on the /invite/:token landing page.
// Transparent background, bottom border only, no focus ring — instead the
// bottom rule darkens to `foreground` on focus. Kept distinct from the
// default <Input/> so the core primitive stays untouched.
const UnderlineInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full border-0 border-b border-border bg-transparent px-0 py-3 text-[15px] text-foreground placeholder:text-muted-foreground transition-colors duration-150 [transition-timing-function:var(--ease-out)] focus:outline-none focus:border-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
UnderlineInput.displayName = "UnderlineInput";

export { UnderlineInput };
