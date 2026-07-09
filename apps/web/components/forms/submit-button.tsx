"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

type SubmitButtonProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  pendingLabel?: string;
  name?: string;
  value?: string;
};

export function SubmitButton({
  children,
  className,
  disabled = false,
  pendingLabel = "Guardando...",
  name,
  value,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled || pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
