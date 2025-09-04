import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const base = "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium";
  const styles = {
    default: "bg-primary text-primary-foreground",
    secondary: "border text-muted-foreground",
    outline: "border",
  } as const;

  return <span className={cn(base, styles[variant], className)} {...props} />;
}



