export default function ChatPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        Content
      </div>
      <footer className="shrink-0 px-4 py-3 pb-[env(safe-area-inset-bottom)]">
        <button className="w-full py-2 bg-gold text-dark-gray rounded-lg">
          Reply
        </button>
      </footer>
    </>
  );
};
