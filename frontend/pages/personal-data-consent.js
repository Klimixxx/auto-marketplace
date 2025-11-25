const sections = [
  {
    title: "1. Общие положения",
    text:
      "Заполняя форму регистрации, вы подтверждаете своё согласие на обработку персональных данных, предоставленных в сервисе AuctionAfto, включая передачу смс-кода и последующую идентификацию в системе.",
  },
  {
    title: "2. Перечень данных",
    text:
      "Мы обрабатываем номер телефона, технические данные устройства (IP-адрес, браузер, файл cookies) и сведения, которые вы передаёте при использовании сервиса.",
  },
  {
    title: "3. Цели обработки",
    text:
      "Данные используются для регистрации и авторизации в приложении, обеспечения безопасности аккаунта, улучшения качества сервиса и выполнения требований законодательства.",
  },
  {
    title: "4. Срок хранения",
    text:
      "Персональные данные хранятся на протяжении времени использования аккаунта и в течение срока, необходимого для выполнения требований законодательства Российской Федерации.",
  },
  {
    title: "5. Передача третьим лицам",
    text:
      "Передача данных возможна только уполномоченным партнёрам и операторам связи для отправки проверочного кода, а также в случаях, предусмотренных законом.",
  },
  {
    title: "6. Права пользователя",
    text:
      "Вы можете запросить уточнение, блокирование или удаление своих персональных данных, а также отозвать согласие, направив обращение в поддержку сервиса.",
  },
  {
    title: "7. Контакты",
    text:
      "По вопросам обработки персональных данных обращайтесь в службу поддержки: support@auctionafto.example.",
  },
];

export default function PersonalDataConsentModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="personal-consent-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "grid",
        placeItems: "center",
        padding: "24px 12px",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          maxWidth: 900,
          width: "100%",
          border: "1px solid #e5e7eb",
          boxShadow: "0 16px 48px rgba(15,23,42,0.2)",
          maxHeight: "min(90vh, 800px)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
            background: "#f8fafc",
          }}
        >
          <h2
            id="personal-consent-title"
            style={{ margin: 0, fontSize: 20, color: "#0b1220" }}
          >
            Согласие на обработку персональных данных
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              border: "1px solid #e5e7eb",
              background: "white",
              borderRadius: 8,
              width: 34,
              height: 34,
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: 20,
            display: "grid",
            gap: 16,
            overflowY: "auto",
            maxHeight: "calc(min(90vh, 800px) - 74px)",
            color: "#0b1220",
          }}
        >
          <p style={{ margin: "0 0 8px", lineHeight: 1.6 }}>
            Этот документ подготовлен в демонстрационных целях и описывает, как
            сервис AuctionAfto временно обрабатывает персональные данные при
            регистрации и использовании приложения.
          </p>
          {sections.map((section) => (
            <section key={section.title} style={{ display: "grid", gap: 4 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{section.title}</h3>
              <p style={{ margin: 0, lineHeight: 1.55 }}>{section.text}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
