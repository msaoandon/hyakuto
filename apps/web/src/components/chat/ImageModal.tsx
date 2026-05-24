'use client';

type ImageModalProps = {
  file: string;
  onClose: () => void;
};

export function ImageModal({ file, onClose }: ImageModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <img
        src={`/images/${file}`}
        alt="full size"
        className="max-w-full max-h-full object-contain p-4"
      />
    </div>
  );
}
