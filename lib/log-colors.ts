import type { LogType } from "@/types/build"

export const LOG_COLORS: Record<LogType, string> = {
  log: "text-foreground",
  warning: "text-yellow-700 dark:text-yellow-400",
  error: "text-red-700 dark:text-red-400",
  done: "text-green-700 dark:text-green-400",
  progress: "text-sky-700 dark:text-sky-400",
}
