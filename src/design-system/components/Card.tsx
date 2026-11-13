import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: "sm" | "md" | "lg";
}

const paddingClasses = {
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

export function Card({
  interactive = false,
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <section
      {...props}
      className={[
        "rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]",
        "dark:border-white/[0.08] dark:bg-[#111B27] dark:shadow-[0_12px_36px_rgba(0,0,0,0.18)]",
        paddingClasses[padding],
        interactive ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" : "",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}
