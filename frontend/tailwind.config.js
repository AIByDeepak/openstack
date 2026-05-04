/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
                mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            colors: {
                background: "hsl(var(--bg))",
                foreground: "hsl(var(--foreground))",
                sidebar: "hsl(var(--sidebar))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--foreground))",
                    elev: "hsl(var(--card-elev))",
                },
                popover: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--foreground))",
                },
                primary: {
                    DEFAULT: "hsl(var(--foreground))",
                    foreground: "hsl(var(--bg))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--card-elev))",
                    foreground: "hsl(var(--foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--card-elev))",
                    foreground: "hsl(var(--muted))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                    soft: "hsl(var(--accent) / 0.15)",
                },
                destructive: {
                    DEFAULT: "hsl(var(--danger))",
                    foreground: "hsl(0 0% 100%)",
                },
                success: "hsl(var(--success))",
                warning: "hsl(var(--warning))",
                danger: "hsl(var(--danger))",
                info: "hsl(var(--info))",
                teal: "hsl(var(--teal))",
                border: "hsl(var(--border))",
                "border-strong": "hsl(var(--border-strong))",
                input: "hsl(var(--border))",
                ring: "hsl(var(--accent))",
                chart: {
                    1: "hsl(var(--chart-1))",
                    2: "hsl(var(--chart-2))",
                    3: "hsl(var(--chart-3))",
                    4: "hsl(var(--chart-4))",
                    5: "hsl(var(--chart-5))",
                },
            },
            keyframes: {
                "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
                "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
