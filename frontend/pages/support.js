// frontend/pages/support.js
const palette = {
  title: "var(--text-strong)",
  text: "var(--text-600)",
  border: "var(--border)",
  surface: "var(--surface-1)",
  subtle: "var(--surface-2)",
  accent: "var(--accent)",
  accentSoft: "rgba(42,101,247,0.08)",
};

const contactChannels = [
  {
    title: "Горячая линия поддержки",
    description:
      "Ответим на общие вопросы о площадке, поможем с навигацией и регистрацией на торги.",
    items: [
      { label: "Телефон", value: "+7 (495) 123-45-67" },
      { label: "Часы работы", value: "Ежедневно с 09:00 до 21:00 (Мск)" },
    ],
  },
  {
    title: "Эксперт по сделкам",
    description:
      "Разберём нестандартные ситуации, подготовим документы и подскажем, как безопасно завершить сделку.",
    items: [
      { label: "Имя", value: "Екатерина Смирнова" },
      { label: "Телефон", value: "+7 (812) 987-65-43" },
      { label: "Телеграм", value: "@auction_support" },
    ],
  },
  {
    title: "Технический канал",
    description:
      "Сообщите о проблеме в работе сайта, ошибках загрузки документов или оплат. Мы исправим в приоритетном порядке.",
    items: [
      { label: "Email", value: "tech@auctionauto.ru" },
      { label: "Статус", value: "Среднее время решения — 2 часа" },
    ],
  },
];

const trustPoints = [
  "Работаем официально: включены в реестр операторов электронных площадок",
  "Подписываем договор и предоставляем закрывающие документы",
  "Сопровождаем клиента на всех этапах торгов и оформления автомобиля",
  "Все платежи проходят по защищённым каналам и подтверждаются в личном кабинете",
];

const steps = [
  {
    title: "Принимаем запрос",
    description:
      "Фиксируем обращение и назначаем ответственного специалиста в течение 10 минут.",
  },
  {
    title: "Диагностируем",
    description:
      "Анализируем ситуацию, проверяем документы и историю торгов, чтобы предложить решение.",
  },
  {
    title: "Решаем вопрос",
    description:
      "Предоставляем пошаговый план действий, подключаем экспертов и помогаем довести сделку до результата.",
  },
];

export default function Support() {
  return (
    <div className="container" style={{ maxWidth: 1120, padding: "48px 12px 88px" }}>
      <section
        style={{
          background:
            "linear-gradient(135deg, rgba(42,101,247,0.12) 0%, rgba(42,101,247,0.04) 60%, rgba(103,232,249,0.08) 100%)",
          border: `1px solid ${palette.border}`,
          borderRadius: "24px",
          padding: "40px 44px",
          display: "grid",
          gap: 20,
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(42,101,247,0.12)",
            color: palette.accent,
            fontWeight: 600,
            fontSize: 13,
            width: "fit-content",
          }}
        >
          Поддержка клиентов 24/7
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 40,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: palette.title,
            }}
          >
            Всегда рядом, чтобы сделки проходили уверенно
          </h1>
          <p style={{ margin: 0, fontSize: 18, color: palette.text, maxWidth: 620 }}>
            Команда поддержки помогает разобраться с площадкой, подготовить документы и защитить ваши интересы на каждом этапе
            покупки банкротского имущества.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          {["Более 1 200 успешных сделок", "Среднее время ответа — 7 минут", "Собственный отдел аналитики"].map(
            (item) => (
              <div
                key={item}
                style={{
                  background: "rgba(255,255,255,0.85)",
                  borderRadius: 16,
                  padding: "18px 20px",
                  fontWeight: 600,
                  color: palette.title,
                  border: `1px solid rgba(255,255,255,0.6)`
                }}
              >
                {item}
              </div>
            )
          )}
        </div>
      </section>

      <section style={{ marginTop: 48 }}>
        <h2
          style={{
            fontSize: 28,
            margin: 0,
            color: palette.title,
            letterSpacing: "-0.01em",
          }}
        >
          Как с нами связаться
        </h2>
        <p style={{ margin: "8px 0 24px", color: palette.text, maxWidth: 620 }}>
          Выберите удобный канал: звоните, пишите в мессенджеры или отправляйте официальные запросы. Мы держим связь в течение всего дня.
        </p>

        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {contactChannels.map((channel) => (
            <article
              key={channel.title}
              style={{
                background: palette.surface,
                border: `1px solid ${palette.border}`,
                borderRadius: 20,
                padding: "26px 24px",
                boxShadow: "var(--shadow-sm)",
                display: "grid",
                gap: 18,
              }}
            >
              <header style={{ display: "grid", gap: 6 }}>
                <h3 style={{ margin: 0, color: palette.title, fontSize: 20 }}>{channel.title}</h3>
                <p style={{ margin: 0, color: palette.text, fontSize: 15 }}>{channel.description}</p>
              </header>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
                {channel.items.map((item) => (
                  <li key={`${channel.title}-${item.label}`} style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: palette.text }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: palette.title }}>{item.value}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section
        style={{
          marginTop: 56,
          background: palette.subtle,
          border: `1px solid ${palette.border}`,
          borderRadius: 22,
          padding: "36px 40px",
          display: "grid",
          gap: 28,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 28, color: palette.title }}>Почему нам доверяют</h2>
          <p style={{ margin: "10px 0 0", color: palette.text, maxWidth: 640 }}>
            Мы выстраиваем прозрачные процессы и фиксируем всё документально. Поэтому клиенты уверены в результатах и повторно обращаются к нам.
          </p>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          {trustPoints.map((point) => (
            <div
              key={point}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                background: "rgba(255,255,255,0.78)",
                borderRadius: 16,
                padding: "16px 18px",
                border: `1px solid rgba(255,255,255,0.6)`
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: palette.accentSoft,
                  border: `1px solid ${palette.accent}`,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 16,
                  color: palette.accent,
                  fontWeight: 700,
                }}
              >
                ✓
              </span>
              <span style={{ color: palette.title, fontWeight: 600 }}>{point}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 56 }}>
        <h2 style={{ margin: 0, fontSize: 28, color: palette.title }}>Как мы работаем с обращениями</h2>
        <p style={{ margin: "10px 0 28px", color: palette.text, maxWidth: 640 }}>
          Получаете персональное сопровождение от первого звонка до закрытия сделки. Мы фиксируем прогресс в вашей заявке и держим в курсе.
        </p>
        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {steps.map((step, index) => (
            <div
              key={step.title}
              style={{
                position: "relative",
                background: palette.surface,
                border: `1px solid ${palette.border}`,
                borderRadius: 20,
                padding: "26px 24px 28px",
                boxShadow: "var(--shadow-sm)",
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: palette.accentSoft,
                  border: `1px solid ${palette.accent}`,
                  color: palette.accent,
                  fontWeight: 700,
                  fontSize: 18,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {index + 1}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <h3 style={{ margin: 0, fontSize: 20, color: palette.title }}>{step.title}</h3>
                <p style={{ margin: 0, color: palette.text, fontSize: 15 }}>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

