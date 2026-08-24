import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // ─── Status variants ────────────────────────────────────────────────
        active:   "border-green-200  bg-green-50  text-green-700",
        completed:"border-blue-200   bg-blue-50   text-blue-700",
        draft:    "border-gray-200   bg-gray-50   text-gray-600",
        archived: "border-amber-200  bg-amber-50  text-amber-700",
        inactive: "border-gray-200   bg-gray-50   text-gray-500",
        pending:  "border-orange-200 bg-orange-50 text-orange-700",
        cancelled:"border-red-200    bg-red-50    text-red-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
