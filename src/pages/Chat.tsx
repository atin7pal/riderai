import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MessageSquare, Send, Loader2, Bot, User, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Chat() {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; content: string }[]>([
    { role: 'bot', content: 'Hello! I am the OkadaGuard AI Assistant. How can I help you today? You can ask about registration, levy payments, or how to use the panic button.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const systemInstruction = `
        You are the OkadaGuard AI Assistant for Akoko North East Local Government.
        Knowledge Base:
        - Registration: Requires Name, Phone, Address, NIN, Plate Number, and RFID card. Fee is 5,000 Naira.
        - Levies: Daily levy is 200 Naira. Must be paid to authorized officers.
        - Verification: Officers use RFID or Face Recognition to verify riders.
        - Panic Button: Use in emergencies. It sends your GPS and audio to the dashboard.
        - Illegal Levies: Report any officer demanding cash without digital logging via the "Report" feature.
        Keep responses helpful, concise, and professional.
      `;

      const response = await ai.models.generateContent({
        model,
        contents: [...messages.map(m => ({ role: m.role === 'bot' ? 'model' : 'user', parts: [{ text: m.content }] })), { role: 'user', parts: [{ text: userMessage }] }],
        config: { systemInstruction }
      });

      setMessages(prev => [...prev, { role: 'bot', content: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'bot', content: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col gap-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900">AI Support Assistant</h1>
        <p className="text-zinc-500">Get instant answers about the OkadaGuard system.</p>
      </div>

      <div className="flex-1 bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 bg-zinc-50 border-b border-zinc-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
            <Bot className="text-white w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900">OkadaGuard Bot</h3>
            <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">Online • AI Powered</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4 max-w-[85%]",
                  m.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  m.role === 'bot' ? "bg-emerald-100 text-emerald-600" : "bg-zinc-100 text-zinc-600"
                )}>
                  {m.role === 'bot' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                  m.role === 'bot' ? "bg-zinc-50 text-zinc-800 rounded-tl-none" : "bg-emerald-600 text-white rounded-tr-none"
                )}>
                  {m.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <div className="flex gap-4 max-w-[85%]">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div className="p-4 bg-zinc-50 rounded-2xl rounded-tl-none">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-zinc-50 border-t border-zinc-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question..."
              className="flex-1 px-6 py-3 bg-white border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Send className="w-6 h-6" />
            </button>
          </div>
          <p className="text-[10px] text-zinc-400 text-center mt-3 uppercase font-bold tracking-widest flex items-center justify-center gap-1">
            <Info className="w-3 h-3" /> AI can make mistakes. Verify important info.
          </p>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
