type StatusMessageProps = {
  text: string;
};

export function StatusMessage({ text }: StatusMessageProps) {
  return (
    <div className="flex justify-center py-2">
      <span className="text-xs text-beige/40 italic">{text}</span>
    </div>
  );
}
