/** Esqueleto discreto enquanto a tela nova carrega. Só surge se demorar mais de ~200 ms, então telas rápidas não piscam nada. */
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="skel-wrap space-y-4">
      <div className="skel h-9 w-56 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skel h-24 rounded-2xl" />)}</div>
      <div className="skel h-72 rounded-2xl" />
    </div>
  );
}
