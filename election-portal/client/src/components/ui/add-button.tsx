import * as React from "react"
import { Plus } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"

export interface AddButtonProps extends ButtonProps {
  label?: string
  title?: string
}

const AddButton = React.forwardRef<HTMLButtonElement, AddButtonProps>(
  ({ label, title, ...props }, ref) => {
    const buttonTitle = title || label || "Add"
    
    return (
      <Button
        ref={ref}
        size="icon"
        variant="default"
        className="h-11 w-11 shrink-0"
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
