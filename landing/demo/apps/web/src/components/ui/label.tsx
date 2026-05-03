import * as React from "react";
import { cn } from "../../lib/utils";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-stone)]",
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = "Label";
