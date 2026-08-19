import * as React from "react"
import { Plus } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface AddButtonProps extends ButtonProps {
  label?: string
  title?: string
}

const AddButton = React.forwardRef<HTMLButtonElement, AddButtonProps>(
  ({ label, title, className, ...props }, ref) => {
    const buttonTitle = title || label || "Add"

    return (
      <Button
        ref={ref}
        size="icon"
        variant="default"
        className={cn(
          "no-touch-target h-9 w-9 shrink-0 rounded-xl p-0",
          className
        )}
        title={buttonTitle}
        aria-label={buttonTitle}
        {...props}
      >
        <Plus className="h-4 w-4" />
      </Button>
    )
  }
)
AddButton.displayName = "AddButton"

export { AddButton }
