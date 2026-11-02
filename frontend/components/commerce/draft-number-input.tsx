"use client"

import { useState } from "react"
import type { InputHTMLAttributes } from "react"

type DraftNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  initialValue: number
  onValueChange?: (value: number) => void
}

export function DraftNumberInput({ initialValue, onValueChange, ...inputProps }: DraftNumberInputProps) {
  const [draft, setDraft] = useState(String(initialValue))
  const trimmed = draft.trim()
  const parsedValue = /^-?\d+$/.test(trimmed) ? Number(trimmed) : undefined
  const dataValue = Number.isSafeInteger(parsedValue) ? parsedValue : undefined

  return (
    <input
      {...inputProps}
      type="number"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value)
        const num = Number(event.target.value)
        if (!isNaN(num) && onValueChange) {
          onValueChange(num)
        }
      }}
      data-value={dataValue}
    />
  )
}
