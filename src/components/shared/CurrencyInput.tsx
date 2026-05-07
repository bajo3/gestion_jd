import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeMoneyInput } from "@/lib/money";

type CurrencyInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  className,
}: CurrencyInputProps) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
        $
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(normalizeMoneyInput(event.target.value))}
        placeholder={placeholder}
        inputMode="numeric"
        className="pl-7"
      />
    </div>
  );
}
