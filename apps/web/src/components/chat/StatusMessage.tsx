import { memo } from 'react';

type StatusMessageProps = {
  text: string;
};

function StatusMessageInner({ text }: StatusMessageProps) {
  return (
    <div className="flex justify-center py-2">
      <span className="text-xs text-beige/40 italic">{text}</span>
    </div>
  );
}

export const StatusMessage = memo(StatusMessageInner);
