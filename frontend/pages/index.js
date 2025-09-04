import Link from 'next/link';
import FirstLoginModal from '../components/FirstLoginModal';


export default function Home() {
  return (
    <div className="container">
      <header className="header">
        <h1>Auto Auctions Hub</h1>
        <nav className="nav">
          <Link href="/trades">Торги</Link>
          <Link href="/account">Кабинет</Link>
          <Link href="/admin">Админ</Link>
        </nav>
      </header>
    <FirstLoginModal />

      <div className="card" style={{padding:32, textAlign:'center'}}>
        <h2>Все торги — в одном месте</h2>
        <p style={{color:'var(--muted)'}}>
          Мы агрегируем объявления с разных источников и показываем удобную выдачу по фильтрам.
        </p>
        <p>
          <Link className="button" href="/trades">Перейти в каталог →</Link>
        </p>
      </div>

      <footer className="footer">MVP • v0.1</footer>
    </div>
  );
}

