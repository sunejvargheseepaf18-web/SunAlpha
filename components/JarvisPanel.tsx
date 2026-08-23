import React, { useEffect, useRef, useState } from 'react';
import { askAssistant } from '../services/assistantService';
import {
  isVoiceInputSupported,
  isVoiceOutputSupported,
  startListening,
  speak,
  stopSpeaking,
  ListenSession
} from '../services/speechService';
import { Sparkles, X, SendHorizontal, Loader2, Mic, Volume2, VolumeX } from 'lucide-react';

// Jarvis-style assistant: floating "arc reactor" action button + dark
// glass chat overlay (the open-Jarvis UI pattern). Structured commands are
// answered by the app's own engines with exact numbers; free-form text
// goes to the AI lane when online.

interface Message {
  role: 'user' | 'jarvis';
  text: string;
}

const QUICK_CHIPS = ['Portfolio', 'Advice', 'Scans', 'Market', 'Tax', 'Help'];

const WELCOME: Message = {
  role: 'jarvis',
  text: 'Online. Ask about your portfolio, advice, prices, scans, the market regime, tax or alerts — or anything else.'
};

const VOICE_PREF_KEY = 'sunalpha.jarvis.voiceReplies';

export const JarvisPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState<boolean>(() => {
    try {
      return localStorage.getItem(VOICE_PREF_KEY) === '1';
    } catch {
      return false;
    }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listenRef = useRef<ListenSession | null>(null);

  const toggleVoiceReplies = () => {
    setVoiceReplies(v => {
      const next = !v;
      if (!next) stopSpeaking();
      try {
        localStorage.setItem(VOICE_PREF_KEY, next ? '1' : '0');
      } catch {
        // preference just won't persist
      }
      return next;
    });
  };

  const startVoiceInput = () => {
    if (listening || busy) return;
    stopSpeaking(); // don't transcribe our own voice
    const session = startListening(
      interim => setInput(interim),
      final => void send(final), // final utterance auto-sends
      () => setListening(false)
    );
    if (session) {
      listenRef.current = session;
      setListening(true);
    }
  };

  const stopVoiceInput = () => {
    listenRef.current?.stop();
  };

  // Ctrl/Cmd+K toggles, Escape closes — command-palette convention.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text }]);
    setBusy(true);
    const reply = await askAssistant(text);
    setMessages(m => [...m, { role: 'jarvis', text: reply.text }]);
    setBusy(false);
    // Voice leg: speak the reply (rewritten for speech) when enabled.
    if (voiceReplies) speak(reply.text);
  };

  // Closing the panel silences any in-flight speech and listening session.
  useEffect(() => {
    if (!open) {
      stopSpeaking();
      listenRef.current?.stop();
    }
  }, [open]);

  return (
    <>
      {/* Floating action button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Jarvis (Ctrl+K)"
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-500/30 flex items-center justify-center hover:scale-105 transition-transform"
        >
          <span className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping" />
          <Sparkles size={22} className="relative" />
        </button>
      )}

      {/* Chat overlay */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[min(26rem,calc(100vw-2rem))] h-[min(34rem,calc(100vh-4rem))] flex flex-col rounded-2xl overflow-hidden border border-cyan-500/30 bg-slate-950/90 backdrop-blur-xl shadow-2xl shadow-blue-900/40 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-950">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none">Jarvis</p>
                <p className="text-[10px] text-cyan-300/70 mt-0.5">SunAlpha assistant · Ctrl+K</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              {isVoiceOutputSupported() && (
                <button
                  onClick={toggleVoiceReplies}
                  className={`p-1.5 rounded-lg hover:bg-white/10 ${voiceReplies ? 'text-cyan-300' : 'text-white/40 hover:text-white'}`}
                  title={voiceReplies ? 'Voice replies ON — Jarvis speaks answers' : 'Voice replies OFF'}
                >
                  {voiceReplies ? <Volume2 size={15} /> : <VolumeX size={15} />}
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/10">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white/10 text-cyan-50 border border-white/10 rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center text-cyan-300/70 text-xs">
                <Loader2 size={13} className="mr-2 animate-spin" /> working…
              </div>
            )}
          </div>

          {/* Quick chips */}
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {QUICK_CHIPS.map(chip => (
              <button
                key={chip}
                onClick={() => void send(chip)}
                disabled={busy}
                className="px-2.5 py-1 text-[10px] font-bold text-cyan-200 bg-white/5 border border-cyan-500/20 rounded-full hover:bg-cyan-500/20 disabled:opacity-40"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={e => { e.preventDefault(); void send(); }}
            className="flex items-center space-x-2 px-3 pb-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={listening ? 'Listening…' : 'Ask Jarvis…'}
              className={`flex-1 px-3 py-2 text-xs bg-white/10 border rounded-xl text-white placeholder-white/30 outline-none ${
                listening ? 'border-cyan-400/70' : 'border-white/10 focus:border-cyan-400/50'
              }`}
            />
            {isVoiceInputSupported() && (
              <button
                type="button"
                onClick={listening ? stopVoiceInput : startVoiceInput}
                disabled={busy}
                className={`relative p-2 rounded-xl disabled:opacity-40 ${
                  listening
                    ? 'bg-red-500/90 text-white'
                    : 'bg-white/10 text-cyan-200 hover:bg-cyan-500/20 border border-cyan-500/20'
                }`}
                title={listening ? 'Stop listening' : 'Tap to talk'}
              >
                {listening && <span className="absolute inset-0 rounded-xl bg-red-400/40 animate-ping" />}
                <Mic size={15} className="relative" />
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white disabled:opacity-40"
            >
              <SendHorizontal size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
