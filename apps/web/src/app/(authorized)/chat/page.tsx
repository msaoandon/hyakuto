import { ChatFeed } from "@/components/chat/ChatFeed";

export default function ChatPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ChatFeed />
      <footer className="shrink-0 px-4 py-3 pb-[env(safe-area-inset-bottom)]">
        <button className="w-full py-2 bg-papaya-whip text-ink-black rounded-lg">Reply</button>
      </footer>
    </>
  );
}
