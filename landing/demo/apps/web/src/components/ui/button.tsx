import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded text-sm font-medium font-[var(--font-sans)] transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-charcoal)] text-[var(--color-cream)] hover:bg-[oklch(28%_0.012_50)]",
        outline:
          "border border-[var(--color-hairline)] bg-transparent text-[var(--color-charcoal)] hover:bg-[var(--color-sunken)]",
        ghost: "bg-transparent text-[var(--color-charcoal)] hover:bg-[var(--color-sunken)]",
        link: "bg-transparent text-[var(--color-coral)] underline-offset-4 hover:underline",
        destructive: "bg-[oklch(45%_0.16_25)] text-[var(--color-cream)] hover:bg-[oklch(40%_0.16_25)]",
      },
      size: {
        sm: "h-8 px-3 text-[0.75rem]",
        default: "h-9 px-3.5 text-[0.8125rem]",
        lg: "h-10 px-5 text-[0.875rem]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
