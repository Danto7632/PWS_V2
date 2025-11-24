import type { ReactNode } from 'react';

type Props = {
  label: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  disabled: boolean;
};

export function RoleCard({ label, description, icon, onClick, disabled }: Props) {
  return (
    <button
      type="button"
      className="role-card"
      onClick={onClick}
      disabled={disabled}
    >
      <div className="role-icon">{icon}</div>
      <div>
        <h3>{label}</h3>
        <p>{description}</p>
      </div>
    </button>
  );
}
