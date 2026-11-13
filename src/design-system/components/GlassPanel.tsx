import React from "react";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: "subtle" | "medium";
}

const intensityClasses = {
  subtle: "bg-white/65 dark:bg-slate-900/55",
  medium: "bg-white/75 dark:bg-slate-900/70",
};

export function GlassPanel({
  intensity = "subtle",
  className = "",
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div
      {...props}
      className={[
        "rounded-2xl border border-white/70 backdrop-blur-xl",
        "shadow-[0_12px_36px_rgba(15,23,42,0.08)]",
        "dark:border-white/[0.10] dark:shadow-[0_16px_44px_rgba(0,0,0,0.24)]",
        intensityClasses[intensity],
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
