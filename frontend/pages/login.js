// pages/login.js
import { useState, useEffect, useRef } from "react";
import PhoneInput, { toE164Ru } from "../components/PhoneInput";

const API = process.env.NEXT_PUBLIC_API_BASE;

/* ===== UI токены под общий стиль ===== */
const UI = {
  title: "#ffffff",
  text: "rgba(255,255,255,0.80)",
  border: "rgba(255,255,255,0.12)",
  glass: "rgba(255,255,255,0.05)",
  gradFrom: "#67e8f9",
  gradTo: "#c4b5fd",
  button: "#67e8f9",
  buttonHover: "#a5f3fc",
  red: "#EF4444",
};

export default function Login() {
  const [step, setStep] = useState("phone"); // 'phone' → 'code'
  const [phoneLocal, setPhoneLocal] = useState(""); // только 10 цифр без +7
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0); // сек до повторной отправки
  const codeInputRef = useRef(null);

  useEffect(() => {
    if (step === "code" && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [step]);

  useEffect(() => {
    if (!cooldown) return;
    const id = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function requestCode(e) {
    e?.preventDefault?.();
    if (!API)
      return setErr("API_BASE не задан. Установи NEXT_PUBLIC_API_BASE.");
    setErr("");
    setInfo("");
    setLoading(true);
    try {
      // номер в E.164 из локальных 10 цифр
      const phone = toE164Ru(phoneLocal);
      if (!phone) {
        setErr("Введите номер полностью (10 цифр)");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API}/api/auth/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Не удалось отправить SMS");
      }
      setStep("code");
      setCooldown(30);
      setInfo(
        data.dry ? `Код отправлен! (тест: ${data.test})` : "Код отправлен!"
      );
    } catch (e) {
      setErr(e.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    if (!API)
      return setErr("API_BASE не задан. Установи NEXT_PUBLIC_API_BASE.");
    setErr("");
    setLoading(true);
    try {
      // тот же формат номера
      const phone = toE164Ru(phoneLocal);
      if (!phone) {
        setErr("Номер неполный");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API}/api/auth/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();

      // если аккаунт заблокирован — не логиним, показываем текст
      if (res.status === 403 && data?.error) {
        setStep("phone");
        setCode("");
        setErr(data.error); // "Ваш аккаунт заблокирован. Свяжитесь с поддержкой."
        return;
      }

      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Ошибка проверки кода");
      }
      localStorage.setItem("token", data.token);
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/";
      window.location.href = next;
    } catch (e) {
      setErr(e.message || "Ошибка проверки кода");
    } finally {
      setLoading(false);
    }
  }

  const Err = ({ children }) => (
    <div
      style={{
        background: "rgba(239,68,68,0.10)",
        border: "1px solid rgba(239,68,68,0.35)",
        color: "#fecaca",
        padding: "10px 12px",
        borderRadius: 10,
        fontSize: 13.5,
      }}
    >
      {children}
    </div>
  );

  const Info = ({ children }) => (
    <div
      style={{
        background: "rgba(74,222,128,0.10)",
        border: "1px solid rgba(74,222,128,0.35)",
        color: "#86efac",
        padding: "10px 12px",
        borderRadius: 10,
        fontSize: 13.5,
      }}
    >
      {children}
    </div>
  );

  return (
    <section
      style={{
        minHeight: "calc(100dvh - 64px)", // под шапкой
        display: "grid",
        placeItems: "center",
        padding: "24px 12px",
        background: "var(--app-bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
        <div
          style={{
            position: "relative",
            borderRadius: 16,
            background: UI.glass,
            border: `1px solid ${UI.border}`,
            overflow: "hidden",
          }}
        >
          {/* мягкая подсветка внутри карточки */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: -160,
              top: -120,
              width: 560,
              height: 560,
              background: `radial-gradient(560px 340px at 70% 30%, ${UI.gradFrom}22, transparent 60%)`,
              filter: "blur(22px)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: "rgb(11, 18, 32)",
              background: "white",
              border: '1px solid #e5e7eb',
              borderRadius: 16
            }}
          >
            {/* бейдж "только телефон" */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${UI.border}`,
                color: "rgb(11, 18, 32)",
                fontSize: 12.5,
                marginBottom: 10,
              }}
            >
              <Dot /> Вход только по номеру телефона
            </div>

            {/* Заголовок + бренд */}
            <h1
              style={{
                margin: "0 0 6px",
                fontSize: 28,
                lineHeight: 1.2,
                fontWeight: 900,
                color: "rgb(11, 18, 32)",
                letterSpacing: 0.2,
                width: "fit-content",
              }}
            >
              Войти в{" "}
              <span>
                AuctionA<span style={{ color: UI.red }}>f</span>to
              </span>
            </h1>

            <p
              style={{
                margin: "0 0 16px",
                color: "rgb(11, 18, 32)",
                width: "fit-content",
              }}
            >
              Введите номер в формате{" "}
              <strong style={{ color: "rgb(11, 18, 32)" }}>+7</strong> ХХХ ХХХ-ХХ-ХХ. Мы
              отправим код в&nbsp;SMS.
            </p>

            {/* ====== ШАГ 1: номер телефона ====== */}
            {step === "phone" && (
              <form
                onSubmit={requestCode}
                style={{ display: "grid", gap: 12, maxWidth: 520 }}
              >
                <div
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${UI.border}`,
                    borderRadius: 12,
                    padding: 8,
                  }}
                >
                  <PhoneInput
                    value={phoneLocal}
                    onChange={setPhoneLocal}
                    autoFocus
                  />
                </div>

                {err && <Err>{err}</Err>}
                <button
                  disabled={loading || phoneLocal.length !== 10}
                  style={{
                    height: 48,
                    borderRadius: 12,
                    background: "#2a65f7",
                    color: "#fff",
                    fontWeight: 700,
                    border: "none",
                    cursor:
                      loading || phoneLocal.length !== 10
                        ? "not-allowed"
                        : "pointer",
                    opacity: loading || phoneLocal.length !== 10 ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = UI.buttonHover)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = UI.button)
                  }
                >
                  {loading ? "Отправляю…" : "Получить код"}
                </button>
              </form>
            )}

            {/* ====== ШАГ 2: код из SMS ====== */}
            {step === "code" && (
              <form
                onSubmit={verifyCode}
                style={{ display: "grid", gap: 12, maxWidth: 520 }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${UI.border}`,
                    color: "#fff",
                    width: "fit-content",
                  }}
                >
                  Телефон: <b>{toE164Ru(phoneLocal) || ""}</b>
                </div>

                <input
                  ref={codeInputRef}
                  placeholder="Код из SMS"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  style={{
                    height: 48,
                    borderRadius: 12,
                    padding: "0 12px",
                    background: "rgba(0,0,0,0.10)",
                    border: `1px solid ${UI.border}`,
                    color: "#fff",
                    outline: "none",
                    fontSize: 18,
                    letterSpacing: 4,
                    textAlign: "center",
                  }}
                />

                {cooldown > 0 && (
                  <div style={{ color: "#f78f8f" }}>
                    Подождите {cooldown} сек перед повторной отправкой
                  </div>
                )}
                {info && <Info>{info}</Info>}
                {err && <Err>{err}</Err>}

                <button
                  disabled={loading}
                  style={{
                    height: 48,
                    borderRadius: 12,
                    background: UI.button,
                    color: "#000",
                    fontWeight: 700,
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = UI.buttonHover)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = UI.button)
                  }
                >
                  {loading ? "Проверяю…" : "Войти"}
                </button>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    justifyContent: "space-between",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setStep("phone")}
                    style={{
                      height: 44,
                      padding: "0 14px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${UI.border}`,
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Изменить номер
                  </button>

                  <button
                    type="button"
                    onClick={() => cooldown === 0 && requestCode()}
                    disabled={cooldown > 0 || loading}
                    title={
                      cooldown > 0
                        ? `Можно через ${cooldown} сек`
                        : "Отправить код ещё раз"
                    }
                    style={{
                      height: 44,
                      padding: "0 14px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${UI.border}`,
                      color: "#000",
                      cursor:
                        cooldown > 0 || loading ? "not-allowed" : "pointer",
                      opacity: cooldown > 0 || loading ? 0.6 : 1,
                    }}
                  >
                    Отправить код ещё раз
                  </button>
                </div>
              </form>
            )}

            {/* оферта/подсказка */}
            <p
              style={{
                margin: "14px 0 0",
                color: "#000",
                fontSize: 12.5,
                lineHeight: 1.5,
              }}
            >
              Продолжая, вы соглашаетесь с условиями использования и политикой
              конфиденциальности.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* градиентная точка в бейдже */
function Dot() {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        background: `linear-gradient(90deg, ${UI.gradFrom}, ${UI.gradTo})`,
        borderRadius: 999,
        display: "inline-block",
      }}
    />
  );
}
