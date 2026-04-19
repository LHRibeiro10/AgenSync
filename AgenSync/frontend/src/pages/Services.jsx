import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Field, { inputClass } from "../components/Field.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useToast } from "../components/Toast.jsx";
import { money } from "../utils.js";

const emptyForm = { name: "", priceDefault: "", durationMinutes: 60, isActive: true };

export default function Services() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const data = await api.listServices();
      setServices(data.services);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(service) {
    setEditing(service.id);
    setForm({
      name: service.name,
      priceDefault: service.priceDefault,
      durationMinutes: service.durationMinutes,
      isActive: service.isActive
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      priceDefault: Number(form.priceDefault),
      durationMinutes: Number(form.durationMinutes)
    };

    try {
      if (editing) {
        await api.updateService(editing, payload);
        showToast("Serviço atualizado.");
      } else {
        await api.createService(payload);
        showToast("Serviço cadastrado.");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setError("");

    try {
      await api.deleteService(pendingDelete.id);
      showToast("Serviço excluído.");
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
      setPendingDelete(null);
    }
  }

  async function toggleActive(service) {
    setError("");

    try {
      await api.updateService(service.id, {
        name: service.name,
        priceDefault: service.priceDefault,
        durationMinutes: service.durationMinutes,
        isActive: !service.isActive
      });
      showToast(service.isActive ? "Serviço inativado." : "Serviço ativado.");
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Serviços" description="Preço, duração e disponibilidade para criar agendamentos em poucos toques." />
      <Message type="error">{error}</Message>

      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card as="form" onSubmit={handleSubmit} className="space-y-4 p-4 lg:sticky lg:top-24 lg:self-start">
          <div>
            <h2 className="text-lg font-black text-ink">{editing ? "Editar serviço" : "Novo serviço"}</h2>
            <p className="mt-1 text-sm text-muted">Serviços inativos ficam ocultos na criação de novos horários.</p>
          </div>

          <Field label="Nome">
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              className={inputClass}
              placeholder="Corte, esmaltação, limpeza de pele"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Preço padrão">
              <input
                required
                min="0"
                step="0.01"
                type="number"
                value={form.priceDefault}
                onChange={(event) => update("priceDefault", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Duração em minutos">
              <input
                required
                min="1"
                type="number"
                value={form.durationMinutes}
                onChange={(event) => update("durationMinutes", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <label className="flex min-h-14 items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => update("isActive", event.target.checked)}
              className="h-5 w-5 accent-brand"
            />
            <span className="text-sm font-bold text-ink">Ativo para novos agendamentos</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {editing ? (
              <Button variant="secondary" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" loading={saving} className={editing ? "" : "col-span-2"}>
              {editing ? "Atualizar" : "Cadastrar"}
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Serviços cadastrados" description={`${services.length} serviço(s) disponíveis no app`} />
          {loading ? (
            <Loading label="Carregando serviços..." />
          ) : (
            <div className="compact-scroll-list divide-y divide-[#E2E8F0]">
              {services.length ? (
                services.map((service) => (
                  <article key={service.id} className="grid cursor-pointer gap-3 p-4 transition duration-200 hover:bg-[#F8FAFC] active:bg-[#DBEAFE]/40 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-black text-ink">{service.name}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${
                            service.isActive
                              ? "bg-green-50 text-success ring-green-100"
                              : "bg-zinc-100 text-zinc-600 ring-zinc-200"
                          }`}
                        >
                          {service.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-muted">
                        {money(service.priceDefault)} · {service.durationMinutes} min
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                      <Button variant="secondary" onClick={() => toggleActive(service)}>
                        {service.isActive ? "Inativar" : "Ativar"}
                      </Button>
                      <Button variant="secondary" onClick={() => startEdit(service)}>
                        Editar
                      </Button>
                      <Button variant="danger" className="col-span-2" onClick={() => setPendingDelete(service)}>
                        Excluir
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState title="Nenhum serviço cadastrado" description="Crie um serviço para liberar novos agendamentos." />
              )}
            </div>
          )}
        </Card>
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir serviço?"
        description={
          pendingDelete
            ? `${pendingDelete.name} será removido se não houver agendamentos vinculados.`
            : ""
        }
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
