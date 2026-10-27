// Bingkai canvas game bertema Neon City: sudut membulat + pendar pink/ungu.
export function NeonFrame({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex justify-center">
      <div
        className={`w-full cursor-pointer select-none overflow-hidden rounded-[14px] bg-[#07031a] shadow-[0_0_28px_rgba(255,46,159,.45),0_0_60px_rgba(157,77,255,.3)] [&>canvas]:block ${
          wide ? "max-w-[720px]" : "max-w-[400px]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
