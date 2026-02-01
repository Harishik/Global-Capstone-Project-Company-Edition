import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        idle: "bg-muted text-muted-foreground",
        active: "bg-info/10 text-info",
        success: "bg-success/10 text-success",
        error: "bg-destructive/10 text-destructive",
        warning: "bg-warning/10 text-warning",
      },
    },
    defaultVariants: {
      variant: "idle",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  showDot?: boolean;
}

export function StatusBadge({
  className,
  variant,
  showDot = true,
  children,
  ...props
}: StatusBadgeProps) {
  const dotColor = {
    idle: "bg-muted-foreground",
    active: "bg-info animate-pulse",
    success: "bg-success",
    error: "bg-destructive",
    warning: "bg-warning",
  };

  return (
    <div className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {showDot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", dotColor[variant || "idle"])}
        />
      )}
      {children}
    </div>
  );
}
