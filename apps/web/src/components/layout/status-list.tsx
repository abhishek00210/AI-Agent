export function StatusList({
  items,
}: {
  items: Array<{ label: string; value: string; detail: string }>;
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-white p-5 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-normal">{item.value}</p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}
