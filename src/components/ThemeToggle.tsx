"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <button className="p-2 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                <div className="w-5 h-5" />
            </button>
        )
    }

    return (
        <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 bg-white dark:bg-gray-950 transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all top-2 left-2 dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </button>
    )
}
