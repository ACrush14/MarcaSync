"use client";

export interface StepDef {
  id: string;
  t: string;
  s: string;
}

export const STEPS: StepDef[] = [
  { id: "consulta", t: "Consulta", s: "Nome e descrição" },
  { id: "resultado", t: "Resultado", s: "Colidência e classe" },
  { id: "plano", t: "Plano", s: "Setup e monitoramento" },
  { id: "contato", t: "Contato", s: "Fale comigo" },
];

interface StepperProps {
  current: number;
  unlocked: number;
  onNavigate: (index: number) => void;
}

export default function Stepper({ current, unlocked, onNavigate }: StepperProps) {
  return (
    <nav className="stepper" aria-label="Etapas do processo">
      {STEPS.map((step, i) => {
        const cls = i === current ? "current" : i < unlocked ? "done" : "";
        const disabled = i > unlocked;
        return (
          <button
            key={step.id}
            className={`step-btn ${cls}`}
            disabled={disabled}
            onClick={() => onNavigate(i)}
          >
            <span className="step-num">{i < unlocked ? "✓" : i + 1}</span>
            <span className="step-label">
              <span className="t">{step.t}</span>
              <span className="s">{step.s}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
