"use client";

import { toast as sonnerToast } from "sonner";

type ToastProps = {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
};

export function useToast() {
  return {
    toast: (props: ToastProps) => {
      const { title, description, variant = "default" } = props;
      const message = description ? `${title}\n${description}` : title;

      if (variant === "destructive") {
        sonnerToast.error(message);
      } else {
        sonnerToast.success(message);
      }
    },
  };
}

export const toast = sonnerToast;