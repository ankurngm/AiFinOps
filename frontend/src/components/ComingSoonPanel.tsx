interface ComingSoonPanelProps {
  title: string;
  description: string;
}

export function ComingSoonPanel({ title, description }: ComingSoonPanelProps) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-title">{title}</div>
      <p>{description}</p>
    </div>
  );
}
