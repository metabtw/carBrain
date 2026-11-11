"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, ArrowRight, Send, Bot, CheckCircle, ChevronRight } from "lucide-react";
import type { ChatMessage, TuningParams } from "@/lib/types";

interface AiAssistantProps {
  currentParams: TuningParams;
  onApplyParams: (params: Partial<TuningParams>) => void;
}

type PresetAction = {
  text: string;
  short: string;
  color: string;
  arrowColor: string;
  params: Partial<TuningParams> | null;
  response: string;
};

const PRESET_ACTIONS: PresetAction[] = [
  {
    text: "Yokuşta ve sollamada daha sportif hissettir",
    short: "Yokuş / sportif",
    color:
      "bg-[#eef5fc] text-[#1d63ed] border-[#d8e8fa] hover:bg-[#e4effb] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40",
    arrowColor: "text-[#1d63ed] dark:text-blue-400",
    params: {
      turboPressure: 12,
      injection: 6,
      throttleResponse: 12,
      torqueLimiter: 6,
    },
    response:
      "Yokuşlarda ve sollamalarda ekstra tork için turbo basıncını +%12, gaz tepkisini +%12, enjeksiyonu +%6 ve tork limitörünü +%6 olarak öneriyorum. Bu ayar 1.9 TDI motorun erken devirlerde dolmasını sağlar. Güvenlik bekçisi bu değerleri stok donanım zarfı içinde onayladı.",
  },
  {
    text: "Güvenli ve ekonomik bir günlük harita ver",
    short: "Ekonomi",
    color:
      "bg-[#edf8f1] text-[#1b7e38] border-[#d4eedb] hover:bg-[#e2f4e7] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40",
    arrowColor: "text-[#1b7e38] dark:text-emerald-400",
    params: { turboPressure: 4, injection: -6, throttleResponse: 4 },
    response:
      "Günlük kullanım için ideal harita: yakıt tüketimini %8-12 azaltırken motor sağlığını korumak için turbo basıncı dengeli (+%4) tutuldu. Enjeksiyon -%6 ile fakir karışım sınırında kalıyor; EGT ve duman riski düşük.",
  },
  {
    text: "Yakıt basıncını artırırsam ne olur?",
    short: "Yakıt basıncı",
    color:
      "bg-[#f5f1fc] text-[#6d28d9] border-[#e7defa] hover:bg-[#ede5fa] dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40",
    arrowColor: "text-[#6d28d9] dark:text-purple-400",
    params: null,
    response:
      "Enjeksiyon süresi veya yakıt basıncını gereğinden fazla artırırsanız (özellikle +%10 üzeri), dizel motorlarda hava/yakıt oranı zenginleşir; siyah duman ve egzoz gazı sıcaklığı (EGT) yükselir. Bu yüzden stok donanımda güvenli sınır +%10, mutlak sınır +%20'dir. Daha fazlası ancak büyük enjektör, pompa ve dyno doğrulaması ile denenmelidir.",
  },
];

/** Kullanıcı mesajından parametre önerisi türeten basit kural motoru. */
function deriveSuggestion(text: string): {
  aiText: string;
  suggested: Partial<TuningParams> | null;
} {
  const lower = text.toLowerCase();
  const hasAny = (...needles: string[]) => needles.some((needle) => lower.includes(needle));

  if (hasAny("yokuş", "yokus", "bayıl", "bayil", "çekiş", "cekis", "rampa", "tork")) {
    return {
      aiText:
        "Yokuş ve düşük devir şikâyeti için tork limitörü +%6, turbo +%12 ve gaz tepkisi +%12 öneriyorum. Değerler stok donanım zarfında; EGT ve DMF yükü izlenmeli.",
      suggested: { turboPressure: 12, injection: 6, throttleResponse: 12, torqueLimiter: 6 },
    };
  }
  if (hasAny("sport", "hız", "hiz", "atak", "agresif", "stage")) {
    return {
      aiText:
        "Sportif sürüş için turbo +%12, gaz tepkisi +%10 ve enjeksiyon +%5 önerildi. Avansı artırmadan önce EGT probu ve yakıt kalitesini kontrol edin.",
      suggested: { turboPressure: 12, injection: 5, throttleResponse: 10 },
    };
  }
  if (hasAny("yakıt", "yakit", "ekonomi", "tasarruf", "az yaksın", "az yaksin")) {
    return {
      aiText:
        "Yakıt tasarrufu modu: enjeksiyon -%5, turbo +%3 ve gaz tepkisi +%4. Duman limiti düşürülürken EGT ve turbo basıncı dengede kalır.",
      suggested: { turboPressure: 3, injection: -5, throttleResponse: 4 },
    };
  }
  if (hasAny("avans", "vuruntu", "detonasyon", "timing")) {
    return {
      aiText:
        "Avans artışı en riskli parametredir. Bu yakıt basıncında vuruntu riski nedeniyle maksimum +8° artırılabilir; 5° üzerinde EGT ve knock dinleme şarttır. Öneri olarak avansı +3° tutuyorum.",
      suggested: { timingAdvance: 3 },
    };
  }
  return {
    aiText:
      "Öneriniz incelendi. 1.9 TDI stok haritası için dengeli bir başlangıç öneriyorum. Aşağıdaki butonla tüm parametrelere uygulayabilir, ardından gelişmiş panelden ince ayar yapabilirsiniz.",
    suggested: { turboPressure: 8, injection: 2, throttleResponse: 8 },
  };
}

export function AiAssistant({ currentParams, onApplyParams }: AiAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "assistant",
      text:
        "Merhaba! 👋\nAracınızla ilgili ne yapmak istersiniz? Size en uygun ayarları önermeye hazırım. Parametreler uygulandıktan sonra gelişmiş panelden avans, ray basıncı ve tork limitörünü de ayarlayabilirsiniz.",
      timestamp: "Şimdi",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [appliedToast, setAppliedToast] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const appliedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mesaj listesini kendi kaydırma kabında tut. `scrollIntoView` kullanmak
  // tüm sayfayı kaydırdığı için yeni mesaj gönderildiğinde arayüz zıplıyordu.
  const scrollToBottom = useCallback(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(
    () => () => {
      if (appliedTimeout.current) clearTimeout(appliedTimeout.current);
    },
    []
  );

  const flashApplied = () => {
    setAppliedToast(true);
    if (appliedTimeout.current) clearTimeout(appliedTimeout.current);
    appliedTimeout.current = setTimeout(() => setAppliedToast(false), 2500);
  };

  const appendAssistant = (message: Omit<ChatMessage, "id" | "sender" | "timestamp">) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now() + 1}`,
        sender: "assistant",
        timestamp: "Şimdi",
        ...message,
      },
    ]);
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}`, sender: "user", text, timestamp: "Şimdi" },
    ]);
    if (!textToSend) setInputValue("");

    const { aiText, suggested } = deriveSuggestion(text);
    setTimeout(() => appendAssistant({ text: aiText, suggestedParams: suggested ?? undefined }), 450);
  };

  const handleChipClick = (item: PresetAction) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}`, sender: "user", text: item.text, timestamp: "Şimdi" },
    ]);

    setTimeout(() => {
      appendAssistant({ text: item.response, suggestedParams: item.params ?? undefined });
      if (item.params) {
        onApplyParams(item.params);
        flashApplied();
      }
    }, 400);
  };

  const handleApplyRecommended = () => {
    const latestWithParams = [...messages].reverse().find((message) => message.suggestedParams);
    onApplyParams(
      latestWithParams?.suggestedParams || {
        turboPressure: 12,
        injection: 4,
        throttleResponse: 10,
      }
    );
    flashApplied();
  };

  return (
    // Sabit yükseklik + flex kolon: mesaj alanı kendi içinde kayar, öneri
    // çipleri ve giriş alanı her zaman görünür kalır. Önceden kart sol kolonun
    // yüksekliğine uzuyor, mesajlar sayfayı aşağı itiyordu.
    <div className="flex h-[min(70vh,600px)] flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900 sm:p-5 lg:h-[calc(100vh-9rem)] lg:max-h-[720px] lg:min-h-[560px]">
      {/* Başlık */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Oto-Asistan</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span>Çevrimiçi</span>
        </div>
      </div>

      {/* Mesaj akışı: tek başına kayar, dışarıyı itmez */}
      <div
        ref={scrollRef}
        className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable]"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-2.5 ${
              message.sender === "user" ? "flex-row-reverse" : ""
            }`}
          >
            {message.sender === "assistant" ? (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[#1d63ed] dark:bg-blue-950 dark:text-blue-400">
                <Bot className="h-4 w-4" />
              </div>
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white">
                M
              </div>
            )}
            <div
              className={`max-w-[85%] break-words rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                message.sender === "user"
                  ? "bg-[#1d63ed] text-white"
                  : "border border-slate-200/60 bg-[#f4f7fb] text-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
              }`}
            >
              <p className="whitespace-pre-line">{message.text}</p>
              {message.suggestedParams && (
                <p className="mt-2 border-t border-slate-200/70 pt-1.5 text-[10px] font-medium opacity-70 dark:border-slate-600">
                  Öneri hazır · &quot;Öneriyi Uygula&quot; ile parametrelere aktarın
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Öneri çipleri: yatay kaydırmalı tek satır, dikey alan kaplamaz */}
      <div className="mt-3 shrink-0">
        <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <ChevronRight className="h-3 w-3" />
          Hızlı öneriler
        </p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {PRESET_ACTIONS.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleChipClick(item)}
              title={item.text}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${item.color}`}
            >
              <ArrowRight className={`h-3 w-3 shrink-0 ${item.arrowColor}`} />
              <span>{item.short}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Alt alan: giriş + uygula */}
      <div className="mt-2.5 shrink-0 space-y-2.5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Mesajınızı yazın..."
            className="w-full rounded-full border border-slate-200/90 bg-[#f8fafc] py-2 pl-4 pr-10 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-blue-400"
          />
          <button
            type="submit"
            aria-label="Gönder"
            className="absolute right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#0f172a] text-white transition-transform hover:scale-105 dark:bg-slate-700"
          >
            <Send className="ml-0.5 h-3.5 w-3.5" />
          </button>
        </form>

        <button
          type="button"
          onClick={handleApplyRecommended}
          className={`relative flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-sm transition-all ${
            appliedToast
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200/80 bg-[#eef2f9] text-slate-800 hover:bg-[#e4ebf5] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
              <span>Öneriyi Uygula</span>
            </>
          )}
        </button>

        <p className="text-center text-[10px] leading-snug text-slate-400">
          Öneriler güvenlik bekçisinden geçer. Geçerli: turbo {currentParams.turboPressure >= 0 ? "+" : ""}
          {currentParams.turboPressure}% · yakıt {currentParams.injection >= 0 ? "+" : ""}
          {currentParams.injection}% · gaz {currentParams.throttleResponse >= 0 ? "+" : ""}
          {currentParams.throttleResponse}%
        </p>
      </div>
    </div>
  );
}
