import { useCallback, useEffect, useState } from "react";

const rp = (n) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const today = () => new Date().toISOString().slice(0, 10);
const CATS = {
  expense: ["Makanan", "Transportasi", "Tagihan", "Belanja", "Hiburan", "Kesehatan", "Lainnya"],
  income: ["Gaji", "Bonus", "Investasi", "Lainnya"],
};
const api = (path, o = {}) =>
  fetch("/api/" + path, {
    headers: { "Content-Type": "application/json" },
    ...o,
    body: o.body && JSON.stringify(o.body),
  }).then((r) => r.json());

export default function App() {
  const [tab, setTab] = useState("ringkasan");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [txs, setTxs] = useState([]);
  const [goals, setGoals] = useState([]);
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const [t, g, st] = await Promise.all([api("transactions"), api("goals"), api("stats?month=" + month)]);
      setTxs(t); setGoals(g); setS(st); setErr("");
    } catch {
      setErr("Tidak dapat terhubung ke server. Pastikan API berjalan lalu muat ulang halaman.");
    }
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const tabs = { ringkasan: "Ringkasan", transaksi: "Transaksi", anggaran: "Anggaran", target: "Target tabungan" };

  return (
    <>
      <header>
        <div>
          <h1>Finora</h1>
          <p>Saldo kamu saat ini</p>
          <strong className="balance">{rp(s?.balance)}</strong>
        </div>
        <label className="month">Bulan
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </label>
      </header>
      <nav>
        {Object.entries(tabs).map(([k, v]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{v}</button>
        ))}
      </nav>
      <main>
        {err && <p className="err">{err}</p>}
        {s && tab === "ringkasan" && <Summary s={s} />}
        {tab === "transaksi" && <Transactions txs={txs} month={month} reload={load} />}
        {s && tab === "anggaran" && <Budgets budgets={s.budgets} reload={load} />}
        {tab === "target" && <Goals goals={goals} reload={load} />}
      </main>
    </>
  );
}

function Summary({ s }) {
  const cats = Object.entries(s.categories).sort((a, b) => b[1] - a[1]);
  const maxC = Math.max(1, ...cats.map((c) => c[1]));
  const maxT = Math.max(1, ...s.trend.flatMap((t) => [t.income, t.expense]));
  return (
    <>
      <div className="stats">
        <div><span>Pemasukan bulan ini</span><b className="in">{rp(s.income)}</b></div>
        <div><span>Pengeluaran bulan ini</span><b className="out">{rp(s.expense)}</b></div>
        <div><span>Selisih</span><b>{rp(s.income - s.expense)}</b></div>
      </div>
      <section>
        <h2>Pengeluaran per kategori</h2>
        {cats.length === 0 && <p className="muted">Belum ada pengeluaran. Catat transaksi pertamamu di tab Transaksi.</p>}
        {cats.map(([k, v]) => (
          <div className="bar" key={k}>
            <span>{k}</span>
            <div><i className="out" style={{ width: (v / maxC) * 100 + "%" }} /></div>
            <b>{rp(v)}</b>
          </div>
        ))}
      </section>
      <section>
        <h2>Tren 6 bulan terakhir</h2>
        <p className="muted legend"><i className="in" /> Pemasukan <i className="out" /> Pengeluaran</p>
        {s.trend.map((t) => (
          <div className="bar" key={t.month}>
            <span>{t.month}</span>
            <div>
              <i className="in" style={{ width: (t.income / maxT) * 100 + "%" }} />
              <i className="out" style={{ width: (t.expense / maxT) * 100 + "%" }} />
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function Transactions({ txs, month, reload }) {
  const [type, setType] = useState("expense");
  const add = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    await api("transactions", { method: "POST", body: { ...d, type } });
    e.target.reset(); reload();
  };
  const list = txs.filter((t) => t.date.startsWith(month));
  return (
    <>
      <form onSubmit={add}>
        <div className="seg">
          {["expense", "income"].map((t) => (
            <button type="button" key={t} className={type === t ? "on " + t : ""} onClick={() => setType(t)}>
              {t === "expense" ? "Pengeluaran" : "Pemasukan"}
            </button>
          ))}
        </div>
        <select name="category">{CATS[type].map((c) => <option key={c}>{c}</option>)}</select>
        <input name="amount" type="number" min="1" placeholder="Jumlah (Rp)" required />
        <input name="date" type="date" defaultValue={today()} required />
        <input name="note" placeholder="Catatan (opsional)" />
        <button className="primary">Simpan transaksi</button>
      </form>
      <section>
        <h2>Transaksi bulan ini</h2>
        {list.length === 0 && <p className="muted">Belum ada transaksi di bulan ini.</p>}
        {list.map((t) => (
          <div className="row" key={t.id}>
            <div><b>{t.category}</b><span className="muted"> {t.date}{t.note && " · " + t.note}</span></div>
            <b className={t.type === "income" ? "in" : "out"}>{t.type === "income" ? "+" : "−"}{rp(t.amount)}</b>
            <button className="x" aria-label="Hapus" onClick={async () => { await api("transactions/" + t.id, { method: "DELETE" }); reload(); }}>Hapus</button>
          </div>
        ))}
      </section>
    </>
  );
}

function Budgets({ budgets, reload }) {
  const add = async (e) => {
    e.preventDefault();
    await api("budgets", { method: "POST", body: Object.fromEntries(new FormData(e.target)) });
    e.target.reset(); reload();
  };
  return (
    <>
      <form onSubmit={add}>
        <select name="category">{CATS.expense.map((c) => <option key={c}>{c}</option>)}</select>
        <input name="amount" type="number" min="1" placeholder="Batas per bulan (Rp)" required />
        <button className="primary">Atur anggaran</button>
      </form>
      <section>
        <h2>Pemakaian anggaran bulan ini</h2>
        {budgets.length === 0 && <p className="muted">Belum ada anggaran. Tentukan batas untuk kategori yang ingin kamu kontrol.</p>}
        {budgets.map((b) => {
          const pct = (b.spent / b.amount) * 100;
          return (
            <div className="goal" key={b.id}>
              <div className="row">
                <div><b>{b.category}</b><span className="muted"> {rp(b.spent)} dari {rp(b.amount)}</span></div>
                <b className={pct > 100 ? "out" : ""}>{Math.round(pct)}%</b>
                <button className="x" onClick={async () => { await api("budgets/" + b.id, { method: "DELETE" }); reload(); }}>Hapus</button>
              </div>
              <div className="track"><i className={pct > 100 ? "out" : pct > 80 ? "warn" : "in"} style={{ width: Math.min(pct, 100) + "%" }} /></div>
              {pct > 100 && <p className="out small">Melebihi anggaran {rp(b.spent - b.amount)}</p>}
            </div>
          );
        })}
      </section>
    </>
  );
}

function Goals({ goals, reload }) {
  const add = async (e) => {
    e.preventDefault();
    await api("goals", { method: "POST", body: Object.fromEntries(new FormData(e.target)) });
    e.target.reset(); reload();
  };
  const deposit = async (g) => {
    const v = parseFloat(prompt(`Tambah tabungan untuk "${g.name}" (Rp):`));
    if (v > 0) { await api("goals/" + g.id, { method: "PUT", body: { saved: g.saved + v } }); reload(); }
  };
  return (
    <>
      <form onSubmit={add}>
        <input name="name" placeholder="Nama target, mis. Dana darurat" required />
        <input name="target" type="number" min="1" placeholder="Nominal target (Rp)" required />
        <button className="primary">Buat target</button>
      </form>
      <section>
        <h2>Target tabungan</h2>
        {goals.length === 0 && <p className="muted">Belum ada target. Buat satu untuk mulai menabung terarah.</p>}
        {goals.map((g) => {
          const pct = Math.min((g.saved / g.target) * 100, 100);
          return (
            <div className="goal" key={g.id}>
              <div className="row">
                <div><b>{g.name}</b><span className="muted"> {rp(g.saved)} / {rp(g.target)}</span></div>
                <b>{Math.round(pct)}%</b>
                <span>
                  <button className="x" onClick={() => deposit(g)}>Tabung</button>
                  <button className="x" onClick={async () => { await api("goals/" + g.id, { method: "DELETE" }); reload(); }}>Hapus</button>
                </span>
              </div>
              <div className="track"><i className="in" style={{ width: pct + "%" }} /></div>
            </div>
          );
        })}
      </section>
    </>
  );
}
