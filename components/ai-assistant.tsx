"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  ArrowRight,
  Send,
  Bot,
  User,
  CheckCircle,
} from "lucide-react";
import type { TuningParams, ChatMessage } from "@/lib/types";

interface AiAssistantProps {
  currentParams: TuningParams;
  onApplyParams: (params: TuningParams) => void;
}

const PRESET_ACTIONS = [
  {
    text: "Yokuşta ve sollamada daha sportif hissettir",
    color: "bg-[#eef5fc] text-[#1d63ed] border-[#d8e8fa] hover:bg-[#e4effb] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40",
    arrowColor: "text-[#1d63ed] dark:text-blue-400",
    params: { turboPressure: 12, injection: 6, throttleResponse: 12 },
    response:
      "Yokuşlarda ve sollamalarda ekstra tork için turbo basıncını +%12, gaz tepkisini +%12 ve enjeksiyonu +%6 olarak öneriyorum. Bu ayar 1.9 TDI motorun erken devirlerde dolmasını sağlar. Güvenlik bekçisi bu değerleri stok donanım zarfı içinde onayladı.",
  },
  {
    text: "Güvenli ve ekonomik bir günlük harita ver",
    color: "bg-[#edf8f1] text-[#1b7e38] border-[#d4eedb] hover:bg-[#e2f4e7] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40",
    arrowColor: "text-[#1b7e38] dark:text-emerald-400",
    params: { turboPressure: 4, injection: -6, throttleResponse: 4 },
    response:
      "Günlük kullanım için ideal harita: yakıt tüketimini %8-12 azaltırken motor sağlığını korumak için turbo basıncı dengeli (+%4) tutuldu. Enjeksiyon -%6 ile fakir karışım sınırında kalıyor; EGT ve duman riski düşük.",
  },
  {
    text: "Yakıt basıncını artırırsam ne olur?",
    color: "bg-[#f5f1fc] text-[#6d28d9] border-[#e7defa] hover:bg-[#ede5fa] dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40",
    arrowColor: "text-[#6d28d9] dark:text-purple-400",
    params: null,
    response:
      "Enjeksiyon süresi veya yakıt basıncını gereğinden fazla artırırsanız (özellikle +%10 üzeri), dizel motorlarda hava/yakıt oranı zenginleşir; siyah duman ve egzoz gazı sıcaklığı (EGT) yükselir. Bu yüzden stok donanımda güvenli sınır +%10, mutlak sınır +%20'dir. Daha fazlası ancak büyük enjektör, pompa ve dyno doğrulaması ile denenmelidir.",
  },
];

export function AiAssistant({ currentParams, onApplyParams }: AiAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "assistant",
      text: "Merhaba! 👋\nAracınızla ilgili ne yapmak istersiniz? Size en uygun ayarları önermeye hazırım.",
      timestamp: "Şimdi",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [appliedToast, setAppliedToast] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputValue.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text,
      timestamp: "Şimdi",
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue("");

    // Simulate AI smart response
    setTimeout(() => {
      let aiText =
        "Öneriniz incelendi. 1.9 TDI motor haritası için parametreleri optimize ettim. 'Önerilen Değişiklikleri Uygula' butonuna basarak slider'lara uygulayabilirsiniz.";
      let suggested: TuningParams | undefined = {
        turboPressure: 8,
        injection: 2,
        throttleResponse: 8,
      };

      if (text.toLowerCase().includes("sport") || text.toLowerCase().includes("hız")) {
        aiText = "Sportif sürüş için Turbo +12% ve Gaz Tepkisi +10% önerildi.";
        suggested = { turboPressure: 12, injection: 5, throttleResponse: 10 };
      } else if (text.toLowerCase().includes("yakıt") || text.toLowerCase().includes("ekonomi")) {
        aiText = "Yakıt tasarrufu modu: Enjeksiyon -5% ile optimum ekonomi sağlandı.";
        suggested = { turboPressure: 3, injection: -5, throttleResponse: 4 };
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: aiText,
          timestamp: "Şimdi",
          suggestedParams: suggested,
        },
      ]);
    }, 600);
  };

  const handleChipClick = (item: (typeof PRESET_ACTIONS)[0]) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: item.text,
      timestamp: "Şimdi",
    };

    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: item.response,
          timestamp: "Şimdi",
          suggestedParams: item.params || undefined,
        },
      ]);
      if (item.params) {
        onApplyParams(item.params);
        setAppliedToast(true);
        setTimeout(() => setAppliedToast(false), 2500);
      }
    }, 500);
  };

  const handleApplyRecommended = () => {
    // Look for the latest suggested params or default sport safe map
    const latestWithParams = [...messages]
      .reverse()
      .find((m) => m.suggestedParams);
    const target = latestWithParams?.suggestedParams || {
      turboPressure: 12,
      injection: 4,
      throttleResponse: 10,
    };

    onApplyParams(target);
    setAppliedToast(true);
    setTimeout(() => setAppliedToast(false), 2500);
  };

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Oto-Asistan
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Çevrimiçi</span>
          </div>
        </div>

        {/* Message Thread */}
        <div className="mt-4 max-h-[170px] space-y-3 overflow-y-auto pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 ${
                m.sender === "user" ? "flex-row-reverse" : ""
              }`}
            >
              {m.sender === "assistant" ? (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[#1d63ed] dark:bg-blue-950 dark:text-blue-400">
                  <Bot className="h-4 w-4" />
                </div>
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white text-[11px] font-bold">
                  M
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  m.sender === "user"
                    ? "bg-[#1d63ed] text-white"
                    : "bg-[#f4f7fb] text-slate-800 border border-slate-200/60 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-200"
                }`}
              >
                <p className="whitespace-pre-line">{m.text}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Action Preset Chips */}
        <div className="mt-3.5 space-y-2">
          {PRESET_ACTIONS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleChipClick(item)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all ${item.color}`}
            >
              <div className="flex items-center gap-2">
                <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${item.arrowColor}`} />
                <span className="line-clamp-1">{item.text}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Area: Input + Apply Button */}
      <div className="mt-4 space-y-2.5">
        {/* Chat Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Mesajınızı yazın..."
            className="w-full rounded-full border border-slate-200/90 bg-[#f8fafc] py-2 pl-4 pr-10 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-blue-400"
          />
          <button
            type="submit"
            aria-label="Gönder"
            className="absolute right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#0f172a] text-white transition-transform hover:scale-105 dark:bg-slate-700"
          >
            <Send className="h-3.5 w-3.5 ml-0.5" />
          </button>
        </form>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={handleApplyRecommended}
          className={`relative flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-xs font-semibold transition-all shadow-sm ${
            appliedToast
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-[#eef2f9] text-slate-800 border-slate-200/80 hover:bg-[#e4ebf5] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          {appliedToast ? (
            <>
              <CheckCircle className="h-4 w-4" />
              <span>Ayarlar Uygulandı!</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Önerilen Değişiklikleri Uygula</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

