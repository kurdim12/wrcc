// AI Assistant chat. Wired to /api/v1/chat which forwards to OpenRouter
// after injecting live sensor data as context. The user's optional
// `deviceId` (selected from the sidebar of the spectrogram page or a palm
// drawer) is forwarded so the model can be specific.
import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api.js';

const SUGGESTIONS = [
  'Why is this palm critical?',
  'Can I dose now?',
  'Which devices are offline?',
  "Summarize today's incidents",
  'Explain the model caveat',
];

export const AIAssistant = ({ deviceId }) => {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! Ask me about your farm — devices, alerts, what a risk score means, or what to do next. I see live sensor data.' },
  ]);
  const [input, setInput]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [status, setStatus]     = useState({ ready: false, model: '...' });
  const scrollRef = useRef(null);

  useEffect(() => {
    api.chatStatus().then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content }]);
    setBusy(true);
    try {
      const next = [...messages, { role: 'user', content }];
      const r = await api.chat({
        messages: next.map(m => ({ role: m.role, content: m.content })),
        device_id: deviceId,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: r.content, model: r.model }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${e.message}`,
        error: true,
      }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-80 md:w-[420px] flex flex-col overflow-hidden animate-fade-in-up">
          <div className="bg-forest p-4 flex justify-between items-center text-bone">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-bone/15 rounded-lg"><MessageSquare size={18} /></div>
              <div className="leading-tight">
                <div className="font-bold">Palm Guard Analyst</div>
                <div className="text-[10px] opacity-80 font-mono">{status.ready ? status.model : 'offline'}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="hover:bg-white/20 p-1 rounded-lg">
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-[#070b14] custom-scrollbar">
            {!status.ready && (
              <div className="text-xs text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 p-3 rounded-xl flex gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>Analyst unavailable — add <code>PG_OPENROUTER_KEY</code> to <code>backend/.env</code> and restart to enable live farm analysis.</span>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-green-600 text-white rounded-tr-none'
                    : msg.error
                    ? 'bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 text-orange-800 dark:text-orange-200 rounded-tl-none'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-2xl rounded-tl-none flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                  <Loader2 size={14} className="animate-spin" /> thinking...
                </div>
              </div>
            )}

            {messages.length <= 1 && !busy && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Try asking</div>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left text-xs px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-500 hover:text-green-700 dark:hover:text-green-400 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={status.ready ? 'Ask about your farm...' : 'Set PG_OPENROUTER_KEY to enable'}
              disabled={busy}
              className="flex-1 bg-gray-100 dark:bg-gray-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="p-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="focus-ring w-14 h-14 bg-forest hover:bg-forest-600 text-bone rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all relative"
          title="Palm Guard Analyst"
        >
          <MessageSquare size={24} />
          {status.ready && (
            <span className="absolute top-1 right-1 w-3 h-3 bg-forest-400 rounded-full border-2 border-forest animate-heartbeat" />
          )}
        </button>
      )}
    </div>
  );
};

export default AIAssistant;
