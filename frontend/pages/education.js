const palette = {
  background: "linear-gradient(120deg, rgba(23,28,45,0.98) 0%, rgba(32,42,78,0.92) 60%, rgba(23,94,180,0.88) 100%)",
  surface: "var(--surface-1)",
  surfaceSoft: "var(--surface-2)",
  border: "var(--border)",
  accent: "var(--accent)",
  textPrimary: "var(--text-strong)",
  textSecondary: "var(--text-600)",
  textOnDark: "rgba(255,255,255,0.92)",
};

const heroStats = [
  { label: "Выпускников за 2023", value: "860+" },
  { label: "Средний ROI сделок", value: "32%" },
  { label: "Экспертный модуль", value: "6 недель" },
];

const programBlocks = [
  {
    title: "Аналитика торгов и стратегия",
    description:
      "Учимся читать карточки лотов, оценивать ликвидность и строить стратегию участия с первого захода.",
    points: [
      "Методика скоринга активов",
      "Рабочие таблицы и чек-листы",
      "Практика на реальных кейсах",
    ],
  },
  {
    title: "Юридическая безопасность",
    description:
      "Разбираем законодательство, договоры и типовые ошибки. Получаете шаблоны документов и инструкции.",
    points: [
      "Пошаговая карта сделки",
      "Чек-лист проверки банкрота",
      "Алгоритмы урегулирования споров",
    ],
  },
  {
    title: "Финансы и сопровождение",
    description:
      "Как сформировать бюджет, привлечь инвесторов и контролировать исполнение обязательств после торгов.",
    points: [
      "Модели расчёта доходности",
      "Настройка командной работы",
      "Сопровождение до регистрации",
    ],
  },
];

const formatItems = [
  {
    badge: "Живые эфиры",
    title: "Онлайн-встречи с экспертами",
    description:
      "Погружаемся в специфику площадок, делимся свежей аналитикой и отвечаем на вопросы в прямом эфире.",
  },
  {
    badge: "Личный наставник",
    title: "Персональный куратор сделки",
    description:
      "Подбирает лоты под ваши цели, проверяет документы, помогает подготовить заявки и сопровождает на аукционе.",
  },
  {
    badge: "Практика",
    title: "Работа с кейсами",
    description:
      "Тренируемся на архиве из 120+ реальных торгов, разбираем решения и учимся просчитывать сценарии.",
  },
  {
    badge: "Комьюнити",
    title: "Закрытый клуб выпускников",
    description:
      "Обмениваемся лотами, инвестициями и партнёрами. Ежемесячные встречи и доступ к аналитике по рынку.",
  },
];

const timeline = [
  {
    title: "Диагностика целей",
    subtitle: "Выстраиваем ожидания",
    description:
      "Аналитик изучает ваш опыт и ресурсы, формируем стратегию обучения и список целевых лотов.",
  },
  {
    title: "Интенсивное обучение",
    subtitle: "6 недель",
    description:
      "Слушаете модули, выполняете практические задания, получаете обратную связь и доступ к мастер-классам.",
  },
  {
    title: "Первая сделка",
    subtitle: "Поддержка команды",
    description:
      "Сопровождаем участие в торгах, помогаем собрать документы и провести расчёты без ошибок.",
  },
  {
    title: "Рост и масштаб",
    subtitle: "Партнёрский формат",
    description:
      "Подключаем к пулу инвесторов, помогаем масштабировать портфель и строить отдел торгов.",
  },
];

const bonuses = [
  {
    title: "Набор документов",
    description: "Актуальные шаблоны договоров, доверенностей и претензионной переписки.",
  },
  {
    title: "Доступ к аналитике",
    description: "Еженедельная подборка горячих лотов и анализ результатов торгов по регионам.",
  },
  {
    title: "Чат экспертов",
    description: "Ответы специалистов-юристов и аналитиков в течение рабочего дня.",
  },
];

const faqs = [
  {
    question: "Подходит ли обучение, если я никогда не участвовал в торгах?",
    answer:
      "Да. Мы начинаем с базовых модулей и на практике показываем, как выбрать первый лот и оформить заявку. Куратор сопровождает до сделки.",
  },
  {
    question: "Можно ли совмещать обучение с основным бизнесом?",
    answer:
      "Программа строится вокруг вечерних эфиров и записей, которые доступны в любое время. Ключевые задания выполняются в своём темпе.",
  },
  {
    question: "Помогаете ли вы после окончания курса?",
    answer:
      "Да. Выпускники остаются в закрытом клубе, получают консультации экспертов и имеют приоритетное право на совместные сделки.",
  },
];

export default function Education() {
  return (
    <div style={{ background: "var(--surface-0)" }}>
      <section
        style={{
          background: palette.background,
          color: palette.textOnDark,
          padding: "80px 0 96px",
        }}
      >
        <div className="container" style={{ maxWidth: 1120, padding: "0 16px" }}>
          <div
            style={{
              display: "grid",
              gap: 32,
              gridTemplateColumns: "minmax(0, 1fr)",
            }}
          >
            <div style={{ display: "grid", gap: 18 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Образовательная программа Auto Marketplace
              </span>
              <h1
                style={{
                  margin: 0,
                  fontSize: 48,
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                }}
              >
                Научим зарабатывать на торгах по банкротству уверенно и легально
              </h1>
              <p style={{ margin: 0, fontSize: 18, color: "rgba(255,255,255,0.78)", maxWidth: 600 }}>
                Пройдите структурированную программу, чтобы научиться находить перспективные лоты, грамотно участвовать в торгах и
                масштабировать сделки с поддержкой экспертов.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
                <a
                  href="https://wa.me/79001112233"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "16px 26px",
                    borderRadius: 14,
                    background: "var(--accent)",
                    color: "white",
                    fontWeight: 600,
                    textDecoration: "none",
                    fontSize: 16,
                  }}
                >
                  Записаться на консультацию
                </a>
                <a
                  href="#program"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "16px 26px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.32)",
                    color: palette.textOnDark,
                    fontWeight: 600,
                    textDecoration: "none",
                    fontSize: 16,
                  }}
                >
                  Программа обучения
                </a>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 16,
              }}
            >
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: "rgba(10,14,28,0.45)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 18,
                    padding: "22px 20px",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 32, fontWeight: 700 }}>{stat.value}</span>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.64)" }}>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="program" style={{ padding: "80px 0" }}>
        <div className="container" style={{ maxWidth: 1120, padding: "0 16px" }}>
          <header style={{ display: "grid", gap: 12, maxWidth: 720 }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-500)" }}>
              Программа
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: 36,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: palette.textPrimary,
              }}
            >
              Три блока, которые проведут вас от первого лота до стратегии портфельных сделок
            </h2>
            <p style={{ margin: 0, fontSize: 17, color: palette.textSecondary }}>
              Каждую неделю фиксируем прогресс, даём обратную связь и подключаем экспертов по правовым и финансовым вопросам.
            </p>
          </header>

          <div
            style={{
              marginTop: 40,
              display: "grid",
              gap: 20,
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            {programBlocks.map((block) => (
              <article
                key={block.title}
                style={{
                  background: palette.surface,
                  borderRadius: 22,
                  border: `1px solid ${palette.border}`,
                  padding: "28px 26px",
                  display: "grid",
                  gap: 16,
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 22, color: palette.textPrimary }}>{block.title}</h3>
                <p style={{ margin: 0, fontSize: 15.5, color: palette.textSecondary }}>{block.description}</p>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
                  {block.points.map((point) => (
                    <li key={`${block.title}-${point}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span
                        aria-hidden
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          marginTop: 6,
                          borderRadius: "50%",
                          background: "var(--accent)",
                        }}
                      />
                      <span style={{ fontSize: 15, color: palette.textPrimary }}>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "72px 0", background: "var(--surface-1)" }}>
        <div className="container" style={{ maxWidth: 1120, padding: "0 16px" }}>
          <div
            style={{
              display: "grid",
              gap: 28,
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {formatItems.map((item) => (
              <article
                key={item.title}
                style={{
                  background: "white",
                  borderRadius: 20,
                  padding: "26px 24px",
                  display: "grid",
                  gap: 16,
                  border: `1px solid rgba(32,42,78,0.08)`,
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--accent)",
                  }}
                >
                  {item.badge}
                </span>
                <h3 style={{ margin: 0, fontSize: 20, color: palette.textPrimary }}>{item.title}</h3>
                <p style={{ margin: 0, fontSize: 15, color: palette.textSecondary }}>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "80px 0" }}>
        <div className="container" style={{ maxWidth: 1120, padding: "0 16px" }}>
          <header style={{ display: "grid", gap: 12, textAlign: "center", marginBottom: 40 }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-500)" }}>
              Этапы сопровождения
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: 34,
                color: palette.textPrimary,
                letterSpacing: "-0.02em",
              }}
            >
              От первого созвона до масштабирования портфеля
            </h2>
          </header>

          <div
            style={{
              display: "grid",
              gap: 24,
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {timeline.map((stage, index) => (
              <article
                key={stage.title}
                style={{
                  background: palette.surface,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 20,
                  padding: "28px 24px",
                  display: "grid",
                  gap: 10,
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 20,
                    right: 24,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-500)",
                  }}
                >
                  0{index + 1}
                </span>
                <h3 style={{ margin: 0, fontSize: 20, color: palette.textPrimary }}>{stage.title}</h3>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>{stage.subtitle}</span>
                <p style={{ margin: 0, fontSize: 15, color: palette.textSecondary }}>{stage.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "72px 0",
          background: "linear-gradient(135deg, rgba(42,101,247,0.08), rgba(103,232,249,0.12))",
        }}
      >
        <div className="container" style={{ maxWidth: 1120, padding: "0 16px" }}>
          <div
            style={{
              display: "grid",
              gap: 24,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            {bonuses.map((bonus) => (
              <article
                key={bonus.title}
                style={{
                  background: "rgba(255,255,255,0.92)",
                  borderRadius: 20,
                  padding: "26px 24px",
                  border: "1px solid rgba(42,101,247,0.12)",
                  display: "grid",
                  gap: 10,
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 20, color: palette.textPrimary }}>{bonus.title}</h3>
                <p style={{ margin: 0, fontSize: 15, color: palette.textSecondary }}>{bonus.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "80px 0" }}>
        <div className="container" style={{ maxWidth: 920, padding: "0 16px" }}>
          <header style={{ display: "grid", gap: 12, textAlign: "center", marginBottom: 40 }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-500)" }}>
              Вопросы и ответы
            </span>
            <h2 style={{ margin: 0, fontSize: 32, color: palette.textPrimary }}>Частые вопросы об обучении</h2>
          </header>

          <div style={{ display: "grid", gap: 16 }}>
            {faqs.map((faq) => (
              <article
                key={faq.question}
                style={{
                  borderRadius: 18,
                  border: `1px solid ${palette.border}`,
                  padding: "22px 24px",
                  background: palette.surface,
                  display: "grid",
                  gap: 10,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 18, color: palette.textPrimary }}>{faq.question}</h3>
                <p style={{ margin: 0, fontSize: 15, color: palette.textSecondary }}>{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "72px 0 96px",
          background: "var(--surface-1)",
        }}
      >
        <div className="container" style={{ maxWidth: 960, padding: "0 16px" }}>
          <div
            style={{
              borderRadius: 28,
              background:
                "linear-gradient(135deg, rgba(23,28,45,0.95) 0%, rgba(32,42,78,0.88) 60%, rgba(42,101,247,0.85) 100%)",
              color: "white",
              padding: "48px 44px",
              display: "grid",
              gap: 20,
              justifyItems: "start",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.02em" }}>
              Готовы обсудить ваши цели и подобрать формат обучения?
            </h2>
            <p style={{ margin: 0, fontSize: 17, color: "rgba(255,255,255,0.72)" }}>
              Оставьте заявку на консультацию — покажем программу, рассчитаем прогноз прибыли и сформируем план действий под ваш запрос.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              <a
                href="https://auto-marketplace-pi.vercel.app/support"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px 26px",
                  borderRadius: 14,
                  background: "var(--accent)",
                  color: "white",
                  fontWeight: 600,
                  textDecoration: "none",
                  fontSize: 16,
                }}
              >
                Оставить заявку
              </a>
              <a
                href="tel:+74951234567"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px 26px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.32)",
                  color: "white",
                  fontWeight: 600,
                  textDecoration: "none",
                  fontSize: 16,
                }}
              >
                Позвонить эксперту
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
