# AutoTune AI · Yapay Zeka Destekli ECU Tuning Stüdyosu

> **Önemli güvenlik uyarısı**
> Bu proje bir eğitim / mühendislik demo ortamıdır. Gerçek bir araca yazılan
> hatalı bir `.bin` dosyası ECU'yu kilitleyebilir (brick), motor mekanik olarak
> hasar görebilir veya emisyon/garanti kuralları ihlal edilebilir. Depodaki
> `data/edc15_19tdi_stock.bin` dosyası **sentetik demo verisidir**; gerçek bir
> araca yazılmamalıdır. Her zaman orijinal dump'ınızı yedekleyin, parça
> numarası/yazılım sürümü eşleşmesini doğrulayın ve dyno + EGT + geniş bant
> lambda ile test edin.

AutoTune AI; Next.js arayüzü, FastAPI/NumPy tabanlı ikili dosya (binary) motoru,
Bosch EDC15 checksum imzalayıcısı ve kural tabanlı mühendislik güvenlik bekçisinden
oluşan tam yığın (full-stack) bir ECU kalibrasyon platformudur.

Arayüzün tamamı Türkçedir. Slider'lar artık yalnızca görsel bir önizleme değil;
Python çekirdeğindeki gerçek 16x16 harita hücrelerini değiştirir. Dışa aktarılan
dosya, checksum'ı yeniden hesaplanıp doğrulanmadan indirilmez.

---

## İçindekiler

1. [Mimari ve teknoloji yığını](#1-mimari-ve-teknoloji-yığını)
2. [Klasör yapısı](#2-klasör-yapısı)
3. [Binary parser nasıl çalışır?](#3-binary-parser-nasıl-çalışır)
4. [Harita tanımları ve doğrulanmış offset politikası](#4-harita-tanımları-ve-doğrulanmış-offset-politikası)
5. [Matematiksel değiştirici (modifier)](#5-matematiksel-değiştirici-modifier)
6. [Checksum motoru ve brick koruması](#6-checksum-motoru-ve-brick-koruması)
7. [Mühendislik güvenlik bekçisi (guardrails)](#7-mühendislik-güvenlik-bekçisi-guardrails)
8. [REST API](#8-rest-api)
9. [Arayüz sayfaları](#9-arayüz-sayfaları)
10. [Datalogger (OBD2 log analizi)](#10-datalogger-obd2-log-analizi)
11. [Yerel kurulum](#11-yerel-kurulum)
12. [Testler](#12-testler)
13. [GitHub'a gönderme sorununun düzeltilmesi](#13-githuba-gönderme-sorununun-düzeltilmesi)
14. [Üretim yol haritası](#14-üretim-yol-haritası)

---

## 1. Mimari ve teknoloji yığını

| Katman | Teknoloji | Görev |
| --- | --- | --- |
| Arayüz | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Three.js | Türkçe dashboard, slider'lar, 3B harita, dosya yükleme, datalogger |
| API köprüsü | Next.js Route Handlers (`app/api/**`) | Tarayıcıdan gelen istekleri Python CLI / FastAPI'ye taşır |
| Çekirdek | Python 3.11+, FastAPI, NumPy | Binary ayrıştırma, matris matematiği, checksum, güvenlik |
| Binary | `struct` + NumPy `frombuffer` | 8/16-bit, little/big endian, sınır kontrollü okuma/yazma |
| Test | pytest, FastAPI TestClient, httpx | Parser, modifier, checksum, guardrail ve API testleri |
| Veri | Yerel demo `.bin` + `.xdf` | Doğrulanmış demo profili; üretimde Supabase Storage/PostgreSQL |

Temel akış:

```
.bin yükle
   │
   ▼
parser.py ──► boyut + ECU kimlik doğrulaması ──► profil eşleşmezse RED
   │
   ▼
guardrails.py ──► turbo / yakıt / EGT / tork / avans / ray basıncı kontrolü
   │                └── limit dışıysa 422 SafetyViolation
   ▼
modifier.py ──► NumPy ile sadece ilgili harita dikdörtgenini ölçekle
   │
   ▼
checksum.py ──► imzayı yeniden hesapla ──► dosyayı tekrar oku ──► doğrula
   │
   ▼
.bin indir  (imza geçmezse indirme yok)
```

## 2. Klasör yapısı

```
carBrain/
├─ app/                      # Next.js App Router (tüm arayüz Türkçe)
│  ├─ page.tsx               # Kontrol paneli
│  ├─ datalogger/page.tsx    # OBD2 CSV log analizi
│  ├─ my-files/page.tsx      # Dosya arşivi + sürüm zinciri
│  ├─ presets/page.tsx       # Hazır harita / pazar yeri
│  ├─ learn/page.tsx         # Tuning akademisi
│  ├─ settings/page.tsx      # Emniyet ve checksum ayarları
│  ├─ about/page.tsx         # Mimari açıklamaları
│  └─ api/
│     ├─ ecu/matrix/route.ts # Harita okuma (parser CLI)
│     ├─ ecu/export/route.ts # Güvenli dışa aktarma (cli_tune.py)
│     ├─ ecu/upload/route.ts # Dosya doğrulama + oturum
│     ├─ ai/analyze-map/...  # Ollama / XDF doğrulayıcı
│     └─ datalogger/analyze/ # CSV log analizi
├─ components/               # Dashboard, slider kartları, 3B görselleştirici
├─ backend/
│  ├─ profiles.py            # Doğrulanmış ECU/harita/checksum tanımları
│  ├─ parser.py              # Sınır kontrollü binary okuyucu (NumPy)
│  ├─ modifier.py            # Güvenli matris ölçekleme
│  ├─ checksum.py            # Bölge bazlı imza hesaplama + seal/verify
│  ├─ guardrails.py          # Mühendislik limitleri ve SafetyViolation
│  ├─ datalogger.py          # OBD2 CSV analiz motoru
│  ├─ ollama_analyzer.py     # Yerel LLM + XDF doğrulayıcı (hata kodlu)
│  ├─ main.py                # FastAPI uygulaması
│  ├─ cli_tune.py            # Next.js export köprüsü (tam güvenli hat)
│  ├─ cli_inspect.py         # Yükleme öncesi salt-okunur doğrulama
│  ├─ ecu_parser.py          # Eski CLI için uyumluluk katmanı
│  ├─ checksum_engine.py     # Eski import'lar için uyumluluk katmanı
│  ├─ requirements.txt
│  └─ tests/                 # pytest paketi
├─ data/
│  ├─ edc15_19tdi_stock.bin  # Sentetik 512 KB demo dump
│  └─ edc15_19tdi.xdf        # TunerPro harita tanımı
├─ pytest.ini
└─ README.md
```

## 3. Binary parser nasıl çalışır?

`backend/parser.py` içindeki `EcuBinary` sınıfı:

1. Dosyayı **tek seferde salt-okunur** `bytes` olarak yükler.
2. Boyutu profil tanımıyla karşılaştırır (`512 * 1024` bayt).
3. `0x3F000` adresindeki kimlik alanında `EDC15` / `BOSCH` anahtar kelimelerini arar.
4. Harita dikdörtgenini `np.frombuffer(...).reshape(rows, cols)` ile NumPy dizisine çevirir.
5. Ham değeri fiziksel değere çevirir:

```
fiziksel_değer = ham_değer * factor + offset
```

Örnek: turbo haritasında `21_500` ham değeri `0.1` faktörü ile `2_150 mbar`
mutlak basınca karşılık gelir. `1_000 mbar` atmosferik basınçtır; ölçekleme
yapılırken bu taban korunur, yalnızca atmosfer üstü basınç artırılır.

Her okuma öncesi `offset + length <= dosya_boyutu` kontrolü yapılır. Kısa
okuma (truncated file) sessizce sıfırla doldurulmaz; `ValueError` fırlatılır.

Endianness açıkça belirtilir:

- `little` (`<u2`): EDC15'in standart "LoHi" kelime düzeni.
- `big` (`>u2`): HiLo kullanan diğer ECU aileleri için.

Eski Next.js köprüsü hâlâ `backend/ecu_parser.py` dosyasını çağırır. Bu dosya
artık yalnızca `parser.py`'yi yeniden dışa aktaran ince bir uyumluluk katmanıdır;
böylece tek bir doğruluk kaynağı kalır.

## 4. Harita tanımları ve doğrulanmış offset politikası

Offset'ler `backend/profiles.py` içindeki `EDC15_DEMO_PROFILE` tanımından gelir:

| Harita | Adres | Boyut | Faktör | Birim | Açıklama |
| --- | --- | --- | --- | --- | --- |
| Turbo hedef basıncı | `0x4D200` | 16x16 | 0.1 | mbar | Ladedruck Soll |
| Sürücü isteği | `0x4C120` | 16x16 | 0.01 | mg/str | Fahrerwunsch |
| Duman limiti | `0x4E150` | 16x16 | 0.01 | mg/str | Rauchbegrenzer |
| Tork limitörü | `0x4F080` | 1x16 | 0.01 | mg/str | Drehmomentbegrenzer |

**Bu adresler evrensel EDC15 adresleri değildir.** Projedeki
`data/edc15_19tdi.xdf` ve sentetik stok dosyaya göre tanımlanmış **demo
profilidir** (`confidence="demo"`). Bosch, aynı EDC15P+ ailesinde onlarca farklı
yazılım sürümü yayınladı; offsetler yazılım numarasına göre değişir.

Bu yüzden parser "tahmini offset" ile çalışmaz:

- Dosya boyutu yanlışsa → `UnsupportedEcuError` (`SIZE_MISMATCH`).
- Kimlik alanı boş veya anahtar kelime yoksa → `PROFILE_NOT_FOUND`.
- Harita dosya sınırının dışındaysa → `MAP_OUT_OF_BOUNDS`.

Gerçek bir araç için yapılması gereken: ECU'dan parça numarası + yazılım sürümü
okumak, aynı sürüme ait doğrulanmış XDF/Damos ile yeni bir `EcuProfile` eklemek
ve ancak checksum'lı okuma-yazma testinden sonra `confidence="verified"`
işaretlemek.

## 5. Matematiksel değiştirici (modifier)

`backend/modifier.py` üç kullanıcı slider'ını şu haritalara bağlar:

| Slider | Harita | Davranış |
| --- | --- | --- |
| Turbo basıncı | `boost` | Yalnızca `> 1000 mbar` hücreleri ölçeklenir |
| Enjeksiyon | `smoke_limiter` | Maksimum yakıt sınırı ölçeklenir |
| Gaz tepkisi | `driver_wish` | Pedal → istenen yakıt miktarı ölçeklenir |
| Tork limitörü | `torque_limiter` | Maksimum izin verilen tork tavanı ölçeklenir |

Arayüzdeki üç ana kartın altındaki **Gelişmiş Parametreler** paneli şunları sunar:

| Parametre | Aralık | Davranış |
| --- | --- | --- |
| Tork limitörü | ±%15 (harita sert sınırı) | `0x4F080` tork tavanı; tek başına tork üretmez |
| Ateşleme avansı | 0–10° (güvenli ≤ 8°) | 8° üzeri backend tarafından reddedilir (vuruntu) |
| Ray basıncı | 0–2100 bar (0 = dokunma) | 1900 bar uyarı, 2100 bar ret |
| Donanım beyanı | 7 seçenek | Büyük turbo + enjektör + dyno üçlüsü zarfı ±%20'den ±%25'e açar |

Avans ve ray basıncı **harita hücresi yazmaz**; bunlar mühendislik zarfı
parametreleridir. Değerler `guardrails.py` tarafından değerlendirilir ve
dışa aktarım sırasında tekrar denetlenir. Böylece arayüzde "kabul edilmiş"
görünen bir ayar, dosyaya yazılmadan önce aynı kurallardan geçer.

Örnek turbo matematiği:

```text
yeni_basınç = 1000 + (eski_basınç - 1000) * (1 + yüzde / 100)
yeni_ham    = round(yeni_basınç / 0.1)
```

Kurallar:

- `NaN` / `Inf` reddedilir.
- Harita başına mutlak sınır (ör. turbo ±%20) aşılırsa `ModificationError`.
- Ham değer `raw_min..raw_max` aralığına kırpılır ve kırpma sayısı raporda
  (`cells_clamped`) döner; sessizce yutulmaz.
- Harita dikdörtgeni dışındaki hiçbir bayt değiştirilmez (test edilir).
- Aynı girdi her zaman aynı çıktıyı üretir (deterministik).

## 6. Checksum motoru ve brick koruması

Bir ECU açılışta flash içeriğini doğrular. Kalibrasyon baytı değiştirilip imza
güncellenmezse ECU dosyayı "bozuk" kabul edebilir; araç çalışmayabilir veya
kontrol ünitesi kilitlenebilir. Buna sahada **brick** denir.

`backend/checksum.py`:

1. Profilde tanımlı her `ChecksumRegion` için 16-bit little-endian kelimeleri
   toplar (32-bit taşma maskesiyle).
2. Saklanan imzayı okur.
3. Üç durum döndürür:
   - `VALID`: saklanan = hesaplanan.
   - `INVALID`: dosya değiştirilmiş veya imza bozuk → dışa aktarma engellenir.
   - `UNSEALED`: alan `0xFF` (hiç imzalanmamış stok dump) → ilk dışa aktarmada imzalanır.
4. `seal()` tüm bölgeleri yeniden hesaplar, yazar ve **kendi çıktısını tekrar
   doğrular**. Doğrulama geçmezse `ChecksumError` fırlatır.
5. FastAPI `/api/download` ve `cli_tune.py`, dosyayı kullanıcıya vermeden önce
   bu doğrulamayı çalıştırır.

Demo profilindeki bölge:

```
Kalibrasyon Bloğu: 0x40000 - 0x5FFFC
Saklanan imza    : 0x5FFFC (4 bayt, little-endian)
Algoritma        : sum16_words_le_u32
```

**Sınırlama:** Gerçek EDC15 yazılımlarında boot bloğu, ana blok ve bazı
durumlarda ayrı "main" checksum bölgeleri bulunur; algoritma her yazılım
sürümünde aynı olmayabilir. Bu modül bölge ve algoritmayı **takılabilir**
(`ALGORITHMS` sözlüğü) yapıda tutar. Yeni bir ECU için doğrulanmış bölge ve
algoritma eklenmeden üretimde kullanılmamalıdır.

## 7. Mühendislik güvenlik bekçisi (guardrails)

`backend/guardrails.py` stok 1.9 TDI (VP37 pompa, GT1749V turbo, stok enjektör)
için muhafazakâr bir zarf uygular:

| Kural | Uyarı | Ret |
| --- | --- | --- |
| Mutlak slider sınırı | — | ±%20 (destek donanımı yoksa) |
| Turbo basıncı | > +%15 | Mutlak sınır aşılırsa |
| Yakıt miktarı | > +%10 | Mutlak sınır aşılırsa |
| Hava/yakıt zarfı | — | `yakıt - turbo > 8` puan |
| Gaz pedalı | > +%15 | — |
| Tork limitörü haritası | > +%10 | > +%15 |
| Avans | > +5° | > +8° → **vuruntu (detonation)** |
| Ray basıncı | > 1900 bar | > 2100 bar |
| Tahmini tork | — | > +%20 (stok donanım) |
| Tahmini EGT | > 850°C | > 900°C |

Örnek ret yanıtı:

```json
{
  "success": false,
  "error": "SAFETY_VIOLATION",
  "detail": "turbo_pct = +25.0% mutlak güvenlik zarfı (±20%) dışında. İstek reddedildi.",
  "safety": {
    "code": "MECHANICAL_LIMIT",
    "field": "turbo_pct",
    "requested": 25.0,
    "limit": 20.0,
    "engineering_explanation": "Stok motor iç bileşenleri ... taşıyamaz. ..."
  }
}
```

Avans için özel mesaj:

> Dikkat! Bu avans değeri bu yakıt basıncında vuruntuya (detonation) yol açar.
> Stok enjektör ve pompa ile maksimum %8 avans artırabilirsin.

Güvenlik bekçisi LLM'in yerine geçmez; LLM yalnızca öneri üretir, **onay
vermek guardrails'in işidir**. Destek donanımı (`upgraded_turbo`,
`upgraded_injectors`, `dyno_verified`) beyan edilirse zarf ±%25'e kadar
genişleyebilir, ancak EGT/tork sert limitleri yine uygulanır.

## 8. REST API

FastAPI servisi: `http://127.0.0.1:8000` · Swagger: `/docs`

| Metot | Yol | Açıklama |
| --- | --- | --- |
| GET | `/api/health` | Servis, profil ve checksum durumu (`/health` ve `/healthz` takma adları da vardır) |
| GET | `/api/ecu/profile` | Profil, haritalar, stok limitleri |
| GET | `/api/ecu/info` | Kimlik, checksum, aktif haritalar |
| POST | `/api/ecu/upload` | `.bin` doğrula ve oturuma al |
| GET | `/api/map/{map}` | 16x16 matris + eksenler + istatistik |
| POST | `/api/validate` | Sadece güvenlik değerlendirmesi |
| POST | `/api/tune` | JSON ile güvenli tune + checksum |
| POST | `/api/patch` | Form ile güvenli tune (eski arayüz uyumu) |
| GET | `/api/download` | İmzalı `.bin` indir (`turbo, injection, throttle, torque, timing, rail, hardware`) |
| GET | `/api/checksum/verify` | Aktif dosyanın imza durumu |
| GET | `/api/ai/status` | Ollama bağlantısı + yüklü modeller |
| GET | `/api/ai/analyze-map` | LLM + XDF harita analizi |
| POST | `/api/ecu/validate` | Canlı güvenlik doğrulaması (dosya yazmaz) |
| GET | `/api/versions` | Sürüm zinciri (metadata) |
| GET | `/api/versions/{id}/download` | Eski sürümü indir |
| POST | `/api/versions/{id}/restore` | Sürümü geri yükle |
| GET | `/api/presets` | Hazır profiller + guardrail sonucu |
| POST | `/api/rag/chat` | Damos bilgi tabanı sohbeti |
| POST | `/api/datalogger/analyze` | OBD2 CSV log analizi |

Next.js köprüsü, Python çekirdeği çalışmasa bile `backend/cli_tune.py`,
`backend/cli_inspect.py` ve `backend/datalogger.py` CLI'ları üzerinden çalışabilir.
Bu, geliştirme sırasında tek `npm run dev` ile denemeyi kolaylaştırır.

### 8.1 Ollama / yerel LLM kurulumu

AI harita analizi üç farklı hata kodu döndürür ve her biri için Türkçe çözüm
önerir. Arayüzdeki "Ollama çevrimiçi / kapalı" rozeti bu durumu canlı gösterir.

| Kod | Anlamı | Çözüm |
| --- | --- | --- |
| `OLLAMA_OFFLINE` | Port 11434 kapalı, servis çalışmıyor | `ollama serve` veya masaüstü uygulamasını açın |
| `OLLAMA_TIMEOUT` | Servis ayakta, model ilk yüklemede yetişmedi | `ollama run qwen2.5-coder:7b` ile önceden yükleyin; `OLLAMA_TIMEOUT` (varsayılan 300 sn) artırın |
| `OLLAMA_MODEL_MISSING` | İstenen model indirilmemiş | `ollama pull qwen2.5-coder:7b` |

Kurulum:

```powershell
# 1) Ollama servisi (ayrı terminal)
ollama serve

# 2) Modeli indir (yaklaşık 4.7 GB)
ollama pull qwen2.5-coder:7b

# 3) Bağlantıyı doğrula
python backend\ollama_analyzer.py --check

# 4) Tek adres analizini dene
python backend\ollama_analyzer.py --address 0x4D200 --timeout 300
```

Ortam değişkenleri:

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama adresi |
| `OLLAMA_MODEL` | `qwen2.5-coder:7b` | CLI varsayılan modeli |
| `OLLAMA_TIMEOUT` | `300` | Üretim (generate) zaman aşımı, saniye |
| `OLLAMA_STATUS_TIMEOUT` | `3` | Bağlantı kontrolü zaman aşımı |
| `OLLAMA_KEEP_ALIVE` | `30m` | Modelin bellekte kalma süresi |
| `AI_ANALYZE_TIMEOUT_MS` | `360000` | Next.js tarafındaki CLI zaman aşımı |

**Neden ilk yanıt yavaş?** CPU'da 7B modelinin belleğe yüklenmesi 30-90 saniye
sürebilir. Eski kod 15 saniyelik sabit bir zaman aşımı kullandığı için model
yüklenirken "Ollama bağlantı hatası: timed out" veriyordu. Artık:

- Zaman aşımı 300 sn (yapılandırılabilir),
- `keep_alive=30m` ile model istekler arasında bellekte tutulur,
- `temperature=0.2`, `num_predict=400` ile yanıt kısa ve deterministiğe yakın,
- Zaman aşımında bile XDF tabanlı sezgisel analiz döner (boş ekran yok),
- Hata kodu ve çözüm adımları arayüzde gösterilir.

Ollama hiç çalışmasa dahi harita analizi **çalışmaya devam eder**: `source`
alanı `heuristic_fallback` olur, `used_fallback=true` döner ve XDF eşleşmesi
yine %100 doğrulanır. Böylece güvenlik doğrulaması LLM'e bağımlı değildir.

## 9. Arayüz sayfaları

- **Kontrol Paneli:** Dosya yükleme, araç özeti, üç slider, **Gelişmiş Parametreler**
  (tork limitörü, avans, ray basıncı, donanım beyanı + canlı guardrail sonucu),
  3B/2B harita, AI asistan ve checksum'lı dışa aktarma. Üstte "1. Doğrula →
  2. Ayarla → 3. İmzala" açıklama şeridi bulunur.
- **Duyarlı yerleşim:** 1024px altında sabit sidebar gizlenir ve üst çubuktaki
  hamburger menü devreye girer; tüm sayfalar tek sütuna iner, yatay kaydırma
  oluşmaz. AI asistan kartı sabit yüksekliktedir — mesaj listesi kendi içinde
  kayar, sayfayı aşağı itmez. Masaüstünde `sticky` olarak görünür kalır.
- **Dosyalarım:** Orijinal ve türetilmiş dosyalar, v1/v2/v3 sürüm zinciri.
- **Pazar Yeri / Hazır Haritalar:** Güvenli günlük, ekonomi, Stage 1 ve yokuş
  profilleri; her profil guardrail sonucu ile listelenir. "Dashboard'da Uygula"
  bağlantısı turbo, enjeksiyon, gaz tepkisi **ve tork limitörünü** query
  parametreleriyle aktarır (`/?turbo=12&injection=5&throttle=12&torque=8`).
- **Canlı Test (OBD2):** CSV yükleme, boost spike/lag/ray basıncı analizi.
- **Tuning Akademisi:** ECU, EGT, checksum ve AFR açıklamaları.
- **Güvenlik & Ayarlar:** Emniyet kilidi, otomatik checksum, yedekleme.
- **Hakkında:** Parser → guardrails → modifier → checksum mimarisi.
- **AI Harita Madencisi (panel içinde):** Ollama canlı durum rozeti, hata kodu +
  çözüm adımları, XDF doğrulama rozeti ve sezgisel yedek analiz.

## 10. Datalogger (OBD2 log analizi)

`backend/datalogger.py` CSV başlıklarını otomatik tanır:

```
RPM,Specified Boost (mbar),Actual Boost (mbar),Rail Pressure (bar),MAF
2000,1800,1780,1350,850
```

Desteklenen ayırıcılar: virgül, noktalı virgül, sekme. Başlık yoksa ilk üç
sütun `rpm, specified, actual` kabul edilir.

Tespitler:

- Boost spike: gerçek basınç istenenin 180 mbar üzerinde.
- Turbo lag: 1.800 devir üzerinde gerçek basınç 250 mbar altında.
- Ray basıncı: 900 bar altı.
- Overboost: 2.700 mbar üzeri.

## 11. Yerel kurulum

Gereksinimler: Node.js 18+, Python 3.11+, npm.

### 1) Depoyu hazırlayın

```powershell
git clone https://github.com/metabtw/carBrain.git
cd carBrain
```

### 2) Python çekirdeği

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

Linux/macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Demo stok dosya yoksa üretin (dosya depoda mevcutsa atlayın):

```powershell
python backend\generate_edc15_data.py
```

> `generate_edc15_data.py` içindeki `__main__` bloğu Windows mutlak yolu
> kullanır. Farklı bir dizinde çalıştırıyorsanız iki yol satırını kendi
> projenize göre düzenleyin veya fonksiyonları doğrudan çağırın.

### 3) FastAPI servisini başlatın

```powershell
python -m uvicorn backend.main:app --reload --port 8000
```

Kontrol: <http://127.0.0.1:8000/api/health> · Swagger: <http://127.0.0.1:8000/docs>

> Next.js API rotaları Python'u CLI olarak da çağırır. Bu nedenle `python`
> komutunun PATH'te olması ve sanal ortamın aktif olması gerekir.

### 4) Next.js arayüzü

```powershell
npm install
npm run dev
```

Arayüz: <http://localhost:3000>

### 5) Üretim derlemesi

```powershell
npm run build
npm start
```

## 12. Testler

```powershell
python -m pytest
```

Beklenen: **74 test geçer**. Kapsam:

- `test_parser.py`: boyut/kimlik doğrulama, sınır kontrolü, little-endian,
  16x16 şekil, eksen ve kalibrasyon.
- `test_modifier.py`: atmosferik taban ölçekleme, negatif yüzde, harita dışı
  baytların korunması, sert limit reddi, determinizm, dry-run.
- `test_checksum.py`: bilinen toplam, UNSEALED → VALID, kurcalama tespiti,
  yeniden imzalama, sınır dışı bölge.
- `test_guardrails.py`: ±%20 reddi, destek donanımı, AFR zarfı, avans/vuruntu,
  EGT sert limiti, NaN reddi.
- `test_api.py`: health, harita, güvenli/güvensiz tune, 422 gövdesi, imzalı
  indirme başlıkları, upload, sürümler, RAG, presetler.
- `test_datalogger.py`: temiz log, spike, lag, düşük ray basıncı, pozisyonel
  fallback, boş dosya.
- `test_ai.py`: Ollama durum kodları, model çözümleme/fallback davranışı.
- `test_api.py` ayrıca `/health`, `/healthz` takma adlarını, `/api/ai/status`
  ucunu, tork limitörü/avans/ray basıncı parametrelerini ve genişletilmiş
  donanım zarfını doğrular.

Tek bir dosya:

```powershell
python -m pytest backend/tests/test_checksum.py -v
```

## 13. GitHub'a gönderme sorununun düzeltilmesi

Depoda iki ayrı sorun vardı:

1. `node_modules/` ve `.next/` **yanlışlıkla Git'e eklenmişti**. Bu, ~79 MB'lık
   bir pack dosyası ve binlerce gereksiz dosya oluşturuyordu.
2. Yerel `main` dalı, GitHub'daki `main` ile **ilişkisiz geçmişe** sahipti
   (yerel ilk commit, uzaktaki "Initial commit"in devamı değildi). Bu yüzden
   normal `git push` "non-fast-forward / unrelated histories" hatası veriyordu.

Uygulanan düzeltme:

```powershell
# 1) Yanlışlıkla izlenen build/bağımlılık klasörlerini indeksten çıkar
git rm -r --cached node_modules .next
git rm -r --cached backend/__pycache__ 2>$null

# 2) .gitignore'u UTF-8 olarak düzelt (node_modules, .next, __pycache__, .env...)
# 3) Yeni temiz commit
git add -A
git commit -m "Türkçe arayüz, FastAPI/NumPy ECU motoru, checksum ve güvenlik katmanı"
```

Uzak depo yalnızca eski bir `README.md` içerdiği için temiz yerel geçmişin
üzerine yazmak güvenliydi.

**Kritik ayrıntı:** `node_modules` yalnızca indeksten çıkarılırsa, silme commit'i
eski 79 MB'lık pack'i hâlâ ebeveyn olarak taşır. İlk `git push` bu yüzden
`HTTP 408` / `RPC failed` ile düşebilir. Depoyu gerçekten küçültmek için temiz
ağacı yeni bir kök (orphan) commit'e taşıdık:

```powershell
git checkout --orphan clean-main
git rm -r --cached --quiet .
git add -A
git commit -m "AutoTune AI v2.0.0 - Türkçe arayüz, FastAPI ECU çekirdeği, checksum ve güvenlik katmanı"
git branch -M main

git config http.postBuffer 524288000
git -c http.lowSpeedLimit=0 -c http.lowSpeedTime=999999 push --force origin main
```

`--force-with-lease` normalde tercih edilir; ancak uzak depo yalnızca tek bir
README commit'i içerdiği ve geçmişler tamamen ilişkisiz olduğu için bu tek
seferlik geçişte `--force` kullanıldı. Ekip çalışmasında önce `git pull --rebase`
veya ortak geçmiş oluşturma (`git merge --allow-unrelated-histories`) tercih edilir.

Doğrulama:

```powershell
git ls-remote origin
git status -sb
```

`node_modules` artık izlenmiyorsa `git ls-files | Select-String node_modules`
boş dönmelidir.

## 14. Üretim yol haritası

Bu depo çekirdek mühendislik hattını ve Türkçe arayüzü içerir. Aşağıdaki
başlıklar üretim sürümü için sıradaki adımlardır:

- **Supabase Storage + PostgreSQL:** Orijinal/yüretilen `.bin` arşivi, sürüm
  tablosu (`bin_versions`), kullanıcı bazlı RLS politikaları.
- **pgvector / Pinecone RAG:** Damos dosyaları ve ECU kılavuzlarının vektör
  indeksi; LLM'in harita adresi önermesi. Öneriler yine `guardrails.py`
  tarafından onaylanmadan uygulanmaz.
- **Gerçek doğrulanmış ECU profilleri:** Her yazılım sürümü için ayrı offset,
  checksum bölgesi ve algoritma; `confidence="verified"` yalnızca saha
  doğrulamasından sonra.
- **Pazar yeri moderasyonu:** Tuner profilleri için imza, kötü amaçlı kod
  taraması, sürüm geçmişi ve lisanslama.
- **Datalogger otomasyonu:** Yüklenen logu son tune sürümüyle ilişkilendirme,
  EGT/lambda/ray basıncı trend grafikleri.
- **Kimlik doğrulama ve kullanım limitleri:** Supabase Auth, API rate limit,
  dosya boyutu/depolama kotaları.

---

### Lisans / sorumluluk

Bu yazılım "olduğu gibi" sunulur. Ticari veya kişisel bir araçta kullanımdan
doğacak mekanik, elektronik veya yasal sonuçlardan kullanıcı sorumludur.
Motor yazılımı değişikliği yapmadan önce yetkili bir ECU tuner'ına danışın.
