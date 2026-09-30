/** The developer credit shown on the start screens. */
export function Credit({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <p
      className={`text-center text-sm font-semibold ${tone === "light" ? "text-[#E4DDFB]" : "text-muted"} ${className}`}
    >
      Developed by <span className="font-extrabold">Benjric Mangulab</span>
    </p>
  );
}
