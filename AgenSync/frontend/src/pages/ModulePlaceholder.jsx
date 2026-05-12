import Card, { CardHeader } from "../components/Card.jsx";
import PageHeader from "../components/PageHeader.jsx";

export default function ModulePlaceholder({ title, description, items = [] }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title={title} description={description} />

      <Card className="p-5">
        <CardHeader
          title="Estrutura preparada"
          description="Este submodulo ja existe na navegacao e pode receber a implementacao completa sem duplicar telas."
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="text-sm font-black text-ink">{item}</p>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}
