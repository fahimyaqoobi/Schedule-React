"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("bg-popover p-3", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("flex flex-col gap-4", defaultClassNames.months),
        month: cn("flex flex-col gap-3", defaultClassNames.month),
        nav: cn(
          "flex items-center justify-between absolute inset-x-0 top-0 h-8",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "select-none",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "select-none",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-8 items-center justify-center text-sm font-semibold",
          defaultClassNames.month_caption
        ),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "w-8 text-center text-[0.7rem] font-medium text-muted-foreground",
          defaultClassNames.weekday
        ),
        week: cn("mt-1 flex w-full", defaultClassNames.week),
        day: cn(
          "relative flex size-8 items-center justify-center p-0 text-sm",
          defaultClassNames.day
        ),
        day_button: cn(
          "flex size-8 items-center justify-center rounded-md font-normal transition-colors hover:bg-muted aria-selected:opacity-100",
          defaultClassNames.day_button
        ),
        today: cn(
          "[&>button]:bg-accent [&>button]:text-accent-foreground [&>button]:font-semibold",
          defaultClassNames.today
        ),
        selected: cn(
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary/90",
          defaultClassNames.selected
        ),
        outside: cn("text-muted-foreground/40", defaultClassNames.outside),
        disabled: cn("text-muted-foreground/30 opacity-50", defaultClassNames.disabled),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" {...chevronProps} />
          ) : (
            <ChevronRight className="size-4" {...chevronProps} />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
