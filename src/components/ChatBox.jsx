import { useEffect, useRef, useState } from 'react';

const COLOR_TEXT = {
  red: 'text-ludo-red', blue: 'text-ludo-blue', green: 'text-ludo-green', yellow: 'text-ludo-yellow',
};

export default function ChatBox({ messages, onSend, you }) {
  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const handleSend = (e) => {
    e?.preventDefault?.();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-4">No messages yet — say hi!</div>
        )}
        {messages.map((m) => {
          const isMe = you && m.player_id === you.id;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${isMe ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'}`}>
                {!isMe && (
                  <div className={`text-[10px] font-bold uppercase ${COLOR_TEXT[m.color] || 'text-slate-500'}`}>
                    {m.player_name}
                  </div>
                )}
                <div className="break-words whitespace-pre-wrap">{m.message}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSend} className="p-2 border-t border-slate-200 dark:border-slate-800 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={500}
          className="input !py-2 text-sm"
        />
        <button type="submit" disabled={!text.trim()} className="btn-primary !py-2 !px-4">Send</button>
      </form>
    </div>
  );
}
