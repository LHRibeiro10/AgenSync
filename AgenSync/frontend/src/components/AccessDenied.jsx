import { Link } from "react-router-dom";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import Icon from "./Icon.jsx";

export default function AccessDenied({
  title = "Acesso nao permitido",
  description = "Seu perfil ou plano atual nao libera esta area."
}) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center p-4">
      <Card className="w-full p-6 text-center shadow-panel">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-brand">
          <Icon name="settings" className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-ink">{title}</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-muted">{description}</p>
        <Link to="/" className="mt-6 inline-flex">
          <Button>Voltar ao dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}
