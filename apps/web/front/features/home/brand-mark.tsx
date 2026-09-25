export function BrandMark({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-xl bg-brand-primary font-serif text-xl font-bold text-white">A</div>
      <div>
        <p className="font-serif text-xl font-semibold text-brand-plum-950">Ponto do Açaí</p>
        <p className="text-xs text-brand-text-muted">{subtitle}</p>
      </div>
    </div>
  );
}
