"""
Engineering guardrails
======================

This is the last line of defence between a slider and a real engine.  It is
deliberately conservative and rule based: the LLM may *recommend* a tune, but
only this module may approve it.

The limits below are based on the mechanical envelope of a stock 1.9 TDI
(VP37 rotary pump, Garrett GT1749V, stock injectors).  They are **not** a
substitute for a dyno session, EGT probe and wideband/lambda logging.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class HardwareProfile:
    id: str = "vw-19tdi-stock"
    name: str = "Volkswagen 1.9 TDI (Stok Donanım)"
    base_hp: int = 101
    base_torque_nm: int = 240
    turbo_model: str = "Garrett GT1749V (stok)"
    injector_model: str = "Bosch 0.216 stok enjektör"
    fuel_pump: str = "Bosch VP37 rotatif pompa"
    egt_warning_c: float = 850.0
    egt_hard_limit_c: float = 900.0
    max_boost_pct_stock: float = 15.0
    max_fuel_pct_stock: float = 10.0
    max_throttle_pct_stock: float = 15.0
    max_torque_gain_pct_stock: float = 20.0
    max_abs_pct: float = 20.0
    max_abs_pct_with_support: float = 25.0


STOCK_19TDI = HardwareProfile()

SUPPORTED_UPGRADES = {
    "upgraded_turbo",
    "upgraded_injectors",
    "upgraded_intercooler",
    "upgraded_clutch",
    "egt_probe",
    "wideband_lambda",
    "dyno_verified",
}

# Upgrades that must ALL be present before the absolute ±20% envelope may be
# exceeded.  This prevents "tick a checkbox" bypasses.
FULL_SUPPORT_REQUIRED = {"upgraded_turbo", "upgraded_injectors", "dyno_verified"}


class SafetyViolation(Exception):
    """Rejected tune with a human-readable engineering explanation."""

    def __init__(
        self,
        message: str,
        *,
        code: str,
        field: str,
        requested: float,
        limit: float,
        explanation: str,
        severity: str = "critical",
    ):
        super().__init__(message)
        self.code = code
        self.field = field
        self.requested = requested
        self.limit = limit
        self.explanation = explanation
        self.severity = severity

    def as_dict(self) -> dict:
        return {
            "code": self.code,
            "field": self.field,
            "requested": self.requested,
            "limit": self.limit,
            "severity": self.severity,
            "message": str(self),
            "engineering_explanation": self.explanation,
        }


@dataclass
class TuningRequest:
    turbo_pct: float = 0.0
    injection_pct: float = 0.0
    throttle_pct: float = 0.0
    torque_pct: float = 0.0
    timing_advance_deg: Optional[float] = None
    rail_pressure_bar: Optional[float] = None
    ambient_temp_c: float = 25.0
    intake_air_temp_c: Optional[float] = None
    hardware_upgrades: List[str] = field(default_factory=list)

    def normalized_upgrades(self) -> set[str]:
        return {str(item).strip().lower() for item in self.hardware_upgrades}


@dataclass
class GuardrailDecision:
    code: str
    severity: str  # info | warning | critical
    field: str
    requested: Optional[float]
    limit: Optional[float]
    message: str
    engineering_note: str

    def as_dict(self) -> dict:
        return {
            "code": self.code,
            "severity": self.severity,
            "field": self.field,
            "requested": self.requested,
            "limit": self.limit,
            "message": self.message,
            "engineering_note": self.engineering_note,
        }


@dataclass
class GuardrailResult:
    allowed: bool
    risk_level: str
    decisions: List[GuardrailDecision]
    warnings: List[str]
    errors: List[str]
    estimated_hp_gain: float
    estimated_torque_gain_pct: float
    estimated_egt_c: float
    hardware: HardwareProfile
    request: TuningRequest

    def as_dict(self) -> dict:
        return {
            "allowed": self.allowed,
            "risk_level": self.risk_level,
            "warnings": self.warnings,
            "errors": self.errors,
            "decisions": [decision.as_dict() for decision in self.decisions],
            "estimated_gain": {
                "hp": self.estimated_hp_gain,
                "torque_pct": self.estimated_torque_gain_pct,
                "egt_c": self.estimated_egt_c,
            },
            "hardware": {
                "id": self.hardware.id,
                "name": self.hardware.name,
                "base_hp": self.hardware.base_hp,
                "base_torque_nm": self.hardware.base_torque_nm,
                "turbo": self.hardware.turbo_model,
            },
            "request": {
                "turbo_pct": self.request.turbo_pct,
                "injection_pct": self.request.injection_pct,
                "throttle_pct": self.request.throttle_pct,
                "torque_pct": self.request.torque_pct,
                "timing_advance_deg": self.request.timing_advance_deg,
                "rail_pressure_bar": self.request.rail_pressure_bar,
                "hardware_upgrades": sorted(self.request.normalized_upgrades()),
            },
        }


def _finite(value: Optional[float], name: str) -> float:
    if value is None:
        return 0.0
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise SafetyViolation(
            f"{name} sayısal olmalı.",
            code="INVALID_INPUT",
            field=name,
            requested=0.0,
            limit=0.0,
            explanation="Sayısal olmayan bir değer gönderildi; işlem reddedildi.",
        )
    if number != number or number in (float("inf"), float("-inf")):
        raise SafetyViolation(
            f"{name} geçersiz (NaN/Inf).",
            code="INVALID_INPUT",
            field=name,
            requested=0.0,
            limit=0.0,
            explanation="Matematiksel olarak geçersiz değer; işlem reddedildi.",
        )
    return number


class GuardrailEngine:
    def __init__(self, hardware: HardwareProfile = STOCK_19TDI):
        self.hardware = hardware

    # ---------------------------------------------------------------- helpers
    @staticmethod
    def _estimate(
        request: TuningRequest, hardware: HardwareProfile
    ) -> tuple[float, float, float]:
        # First-order estimate for UI feedback only.  Real gains must be
        # measured on a dyno; this model intentionally errs on the high side so
        # it triggers warnings earlier.
        torque_gain_pct = (
            0.58 * request.turbo_pct
            + 0.30 * request.injection_pct
            + 0.12 * request.throttle_pct
        )
        hp_gain = hardware.base_hp * (torque_gain_pct / 100.0) * 0.85
        ambient = max(0.0, request.ambient_temp_c - 20.0)
        intake = max(
            0.0,
            (request.intake_air_temp_c - 40.0)
            if request.intake_air_temp_c is not None
            else 0.0,
        )
        egt = (
            600.0
            + 8.5 * request.turbo_pct
            + 4.0 * request.injection_pct
            + 1.5 * request.throttle_pct
            + 0.8 * ambient
            + 1.2 * intake
        )
        return round(hp_gain, 1), round(torque_gain_pct, 1), round(egt, 0)

    # ---------------------------------------------------------------- evaluate
    def evaluate(self, request: TuningRequest) -> GuardrailResult:
        decisions: List[GuardrailDecision] = []
        hardware = self.hardware
        upgrades = request.normalized_upgrades()
        full_support = FULL_SUPPORT_REQUIRED.issubset(upgrades)

        turbo = _finite(request.turbo_pct, "turbo_pct")
        injection = _finite(request.injection_pct, "injection_pct")
        throttle = _finite(request.throttle_pct, "throttle_pct")
        torque = _finite(request.torque_pct, "torque_pct")
        ambient = _finite(request.ambient_temp_c, "ambient_temp_c")
        intake = (
            _finite(request.intake_air_temp_c, "intake_air_temp_c")
            if request.intake_air_temp_c is not None
            else None
        )
        request = TuningRequest(
            turbo_pct=turbo,
            injection_pct=injection,
            throttle_pct=throttle,
            torque_pct=torque,
            timing_advance_deg=request.timing_advance_deg,
            rail_pressure_bar=request.rail_pressure_bar,
            ambient_temp_c=ambient,
            intake_air_temp_c=intake,
            hardware_upgrades=list(request.hardware_upgrades),
        )

        abs_limit = (
            hardware.max_abs_pct_with_support
            if full_support
            else hardware.max_abs_pct
        )
        for field_name, value in (
            ("turbo_pct", turbo),
            ("injection_pct", injection),
            ("throttle_pct", throttle),
            ("torque_pct", torque),
        ):
            if abs(value) > abs_limit:
                decisions.append(
                    GuardrailDecision(
                        code="MECHANICAL_LIMIT",
                        severity="critical",
                        field=field_name,
                        requested=value,
                        limit=abs_limit,
                        message=(
                            f"{field_name} = {value:+.1f}% mutlak güvenlik zarfı "
                            f"(±{abs_limit:.0f}%) dışında. İstek reddedildi."
                        ),
                        engineering_note=(
                            "Stok motor iç bileşenleri (piston, biyel, silindir "
                            "contası) bu tork artışını sürekli yükte taşıyamaz. "
                            "±20% üzeri ancak büyük turbo, büyük enjektör ve "
                            "dyno doğrulaması ile denenmelidir."
                        ),
                    )
                )

        # --- Turbo / overspin ------------------------------------------------
        if turbo > hardware.max_boost_pct_stock:
            severity = "critical" if turbo > abs_limit else "warning"
            decisions.append(
                GuardrailDecision(
                    code="TURBO_OVERSPIN",
                    severity=severity,
                    field="turbo_pct",
                    requested=turbo,
                    limit=hardware.max_boost_pct_stock,
                    message=(
                        f"Turbo basıncı +{turbo:.1f}% stok güvenli sınırın "
                        f"(+{hardware.max_boost_pct_stock:.0f}%) üzerinde."
                    ),
                    engineering_note=(
                        "GT1749V kompresör haritasının sağ sınırına yaklaşır. "
                        "Aşırı devir (overspin) paler kırılmasına, yağ sıcaklığı "
                        "artışına ve turbo ömrünün kısalmasına yol açar. "
                        "Bu seviye için intercooler ve EGT ölçümü şarttır."
                    ),
                )
            )

        # --- Fuel / smoke / EGT ---------------------------------------------
        if injection > hardware.max_fuel_pct_stock:
            decisions.append(
                GuardrailDecision(
                    code="FUEL_LIMIT",
                    severity="critical" if injection > abs_limit else "warning",
                    field="injection_pct",
                    requested=injection,
                    limit=hardware.max_fuel_pct_stock,
                    message=(
                        f"Yakıt miktarı +{injection:.1f}% stok sınırın "
                        f"(+{hardware.max_fuel_pct_stock:.0f}%) üzerinde."
                    ),
                    engineering_note=(
                        "Duman limitörü aşıldığında hava/yakıt oranı zenginleşir; "
                        "siyah duman, partikül ve 850°C üzeri egzoz gazı "
                        "sıcaklığı (EGT) oluşur. Uzun süreli yüksek EGT piston "
                        "üstü ve turbo türbin kanatlarını hasara uğratır."
                    ),
                )
            )
        if injection - turbo > 8.0:
            decisions.append(
                GuardrailDecision(
                    code="AFR_ENVELOPE",
                    severity="critical",
                    field="injection_pct",
                    requested=injection,
                    limit=turbo + 8.0,
                    message=(
                        "Yakıt artışı, hava artışına göre çok yüksek "
                        f"({injection:+.1f}% yakıt / {turbo:+.1f}% turbo)."
                    ),
                    engineering_note=(
                        "Dizel için güvenli zarf, yakıt artışının turbo basınç "
                        "artışından en fazla 8 puan yüksek olmasıdır. Aksi halde "
                        "lambda 1.3'ün altına düşer, EGT hızla yükselir ve "
                        "enjektör püskürtme konisi bozulur."
                    ),
                )
            )

        # --- Throttle map ----------------------------------------------------
        if throttle > hardware.max_throttle_pct_stock:
            decisions.append(
                GuardrailDecision(
                    code="THROTTLE_AGGRESSION",
                    severity="warning",
                    field="throttle_pct",
                    requested=throttle,
                    limit=hardware.max_throttle_pct_stock,
                    message=(
                        f"Gaz pedalı haritası +{throttle:.1f}% agresif; stok "
                        "şanzıman ve debriyaj için önerilmez."
                    ),
                    engineering_note=(
                        "Pedal isteği haritasının aşırı dikleştirilmesi, düşük "
                        "devirde ani tork yükü oluşturur. Çift kütleli volan "
                        "(DMF) ve debriyaj ömrü kısalır; ıslak zeminde "
                        "patinaj/çekiş kaybı artar."
                    ),
                )
            )

        # --- Torque limiter map (0x4F080) ------------------------------------
        # The limiter does not create torque by itself; it only raises the
        # ceiling.  Raising it beyond the fuel/air the maps can deliver simply
        # produces an unattainable target and lets the ECU command more IQ than
        # the hardware can back up.  The map's own hard limit is ±15 %.
        if torque > 15.0:
            decisions.append(
                GuardrailDecision(
                    code="TORQUE_LIMITER_LIMIT",
                    severity="critical",
                    field="torque_pct",
                    requested=torque,
                    limit=15.0,
                    message=(
                        f"Tork limitörü +{torque:.1f}% haritanın izin verdiği "
                        "±15% sınırının dışında. İstek reddedildi."
                    ),
                    engineering_note=(
                        "Tork limitörü (Drehmomentbegrenzer) bir tavan değeridir; "
                        "tek başına tork üretmez. Yakıt ve hava haritaları bu "
                        "tavanı desteklemiyorsa ECU ulaşılamayan bir IQ hedefi "
                        "ister, enjektör duty cycle'ı artar ve limitör koruma "
                        "işlevini yitirir. DMF, debriyaj ve aks için risk oluşur."
                    ),
                )
            )
        elif torque > 10.0:
            decisions.append(
                GuardrailDecision(
                    code="TORQUE_LIMITER_WARNING",
                    severity="warning",
                    field="torque_pct",
                    requested=torque,
                    limit=10.0,
                    message=(
                        f"Tork limitörü +{torque:.1f}% agresif; stok DMF ve "
                        "şanzıman için önerilmez."
                    ),
                    engineering_note=(
                        "Stok 240 Nm tavanı aşılırken çift kütleli volan yayları "
                        "ve debriyaj balatası hızla yorulur. Limitörü artırmak "
                        "yerine önce hava/yakıt dengesini iyileştirin."
                    ),
                )
            )

        # --- Timing advance / detonation ------------------------------------
        if request.timing_advance_deg is not None:
            advance = _finite(request.timing_advance_deg, "timing_advance_deg")
            if advance > 8.0:
                decisions.append(
                    GuardrailDecision(
                        code="DETONATION_RISK",
                        severity="critical",
                        field="timing_advance_deg",
                        requested=advance,
                        limit=8.0,
                        message="Dikkat! Bu avans değeri vuruntu (detonation) riski taşıyor.",
                        engineering_note=(
                            "Dikkat! Bu avans değeri bu yakıt basıncında vuruntuya "
                            "(detonation) yol açar. Stok enjektör ve pompa ile "
                            "maksimum %8 avans artırabilirsin. Daha fazlası piston "
                            "erimesi ve segman kırılması ile sonuçlanabilir."
                        ),
                    )
                )
            elif advance > 5.0:
                decisions.append(
                    GuardrailDecision(
                        code="TIMING_WARNING",
                        severity="warning",
                        field="timing_advance_deg",
                        requested=advance,
                        limit=5.0,
                        message=f"Avans +{advance:.1f}° güvenli tavsiye sınırında.",
                        engineering_note=(
                            "Yakıt kalitesi (setan sayısı) ve emme hava sıcaklığı "
                            "düştükçe vuruntu eğilimi artar. EGT ve knock "
                            "dinleme olmadan 5° üzerine çıkmayın."
                        ),
                    )
                )

        # --- Rail pressure ---------------------------------------------------
        if request.rail_pressure_bar is not None:
            rail = _finite(request.rail_pressure_bar, "rail_pressure_bar")
            if rail > 2100:
                decisions.append(
                    GuardrailDecision(
                        code="RAIL_PRESSURE_LIMIT",
                        severity="critical",
                        field="rail_pressure_bar",
                        requested=rail,
                        limit=2100,
                        message=f"Ray basıncı {rail:.0f} bar stok pompa sınırının üzerinde.",
                        engineering_note=(
                            "VP37 pompası ve common-rail bileşenleri 2_100 bar "
                            "üzerinde sürekli çalışmak için tasarlanmamıştır. "
                            "Basınç regülatörü arızası ve yakıt kaçağı riski "
                            "oluşur. Bu değer ancak uygun pompa yükseltmesiyle "
                            "kullanılabilir."
                        ),
                    )
                )
            elif rail > 1900:
                decisions.append(
                    GuardrailDecision(
                        code="RAIL_PRESSURE_WARNING",
                        severity="warning",
                        field="rail_pressure_bar",
                        requested=rail,
                        limit=1900,
                        message=f"Ray basıncı {rail:.0f} bar yüksek; pompa yükü izlenmeli.",
                        engineering_note="Yakıt sıcaklığı ve pompa dönüş debisi loglanmalı.",
                    )
                )

        # --- Torque envelope -------------------------------------------------
        hp_gain, torque_gain_pct, egt = self._estimate(request, hardware)
        torque_limit = (
            hardware.max_torque_gain_pct_stock if not full_support else 30.0
        )
        if torque_gain_pct > torque_limit:
            decisions.append(
                GuardrailDecision(
                    code="TORQUE_ENVELOPE",
                    severity="critical",
                    field="torque_pct",
                    requested=torque_gain_pct,
                    limit=torque_limit,
                    message=(
                        f"Tahmini tork artışı +{torque_gain_pct:.1f}% stok "
                        f"zarfın (+{torque_limit:.0f}%) üzerinde."
                    ),
                    engineering_note=(
                        "Tahmini tork, turbo + yakıt + pedal haritalarının "
                        "birleşik etkisidir. Stok kavrama ve şanzıman 240 Nm "
                        "üzerinde uzun ömürlü değildir; DMF ve aks kırılması "
                        "riski artar."
                    ),
                )
            )

        # --- EGT envelope ----------------------------------------------------
        if egt > hardware.egt_hard_limit_c:
            decisions.append(
                GuardrailDecision(
                    code="EGT_HARD_LIMIT",
                    severity="critical",
                    field="egt_c",
                    requested=egt,
                    limit=hardware.egt_hard_limit_c,
                    message=f"Tahmini EGT {egt:.0f}°C kritik sınırın üzerinde.",
                    engineering_note=(
                        f"Türbin giriş sıcaklığı {hardware.egt_hard_limit_c:.0f}°C "
                        "üzerinde alüminyum piston ve supap malzemesi yorulur; "
                        "piston erimesi ve turbo hasarı oluşur. EGT probu olmadan "
                        "bu harita yüklenmemelidir."
                    ),
                )
            )
        elif egt > hardware.egt_warning_c:
            decisions.append(
                GuardrailDecision(
                    code="EGT_WARNING",
                    severity="warning",
                    field="egt_c",
                    requested=egt,
                    limit=hardware.egt_warning_c,
                    message=f"Tahmini EGT {egt:.0f}°C uyarı eşiğinde.",
                    engineering_note=(
                        "Sürekli yük altında EGT'yi loglayın; 850°C üzerinde "
                        "gazdan çekin ve soğutma sistemini kontrol edin."
                    ),
                )
            )

        # --- Missing telemetry / hardware warnings ---------------------------
        if full_support and abs_limit > hardware.max_abs_pct:
            decisions.append(
                GuardrailDecision(
                    code="HARDWARE_PRESENT",
                    severity="info",
                    field="hardware_upgrades",
                    requested=None,
                    limit=None,
                    message="Destekleyici donanım beyan edildi; genişletilmiş zarf uygulanıyor.",
                    engineering_note=(
                        "Beyan edilen yükseltmeler doğrulanmış kabul edilir, ancak "
                        "yine de dyno ve EGT logu olmadan yüksek yük haritası "
                        "kullanılmamalıdır."
                    ),
                )
            )
        else:
            for required in sorted(FULL_SUPPORT_REQUIRED - upgrades):
                decisions.append(
                    GuardrailDecision(
                        code="MISSING_SUPPORT",
                        severity="info",
                        field="hardware_upgrades",
                        requested=None,
                        limit=None,
                        message=f"Destekleyici donanım eksik: {required}",
                        engineering_note=(
                            "Stok donanım zarfı uygulanacak. Daha yüksek bir "
                            "hedef için ilgili donanım gerçekten araca takılmalı "
                            "ve dyno ile doğrulanmalıdır."
                        ),
                    )
                )

        errors = [d.message for d in decisions if d.severity == "critical"]
        warnings = [d.message for d in decisions if d.severity == "warning"]
        allowed = not errors
        if errors:
            risk = "critical"
        elif warnings:
            risk = "high"
        elif any(d.severity == "info" for d in decisions):
            risk = "medium"
        else:
            risk = "low"

        return GuardrailResult(
            allowed=allowed,
            risk_level=risk,
            decisions=decisions,
            warnings=warnings,
            errors=errors,
            estimated_hp_gain=hp_gain,
            estimated_torque_gain_pct=torque_gain_pct,
            estimated_egt_c=egt,
            hardware=hardware,
            request=request,
        )

    def enforce(self, request: TuningRequest) -> GuardrailResult:
        result = self.evaluate(request)
        if not result.allowed:
            critical = next(
                decision for decision in result.decisions if decision.severity == "critical"
            )
            raise SafetyViolation(
                critical.message,
                code=critical.code,
                field=critical.field,
                requested=float(critical.requested or 0.0),
                limit=float(critical.limit or 0.0),
                explanation=critical.engineering_note,
                severity=critical.severity,
            )
        return result
