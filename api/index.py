"""Finora API (Flask + SQLAlchemy).
Lokal  : SQLite (finora.db). Vercel: set env DATABASE_URL ke Postgres (mis. Neon)
agar data tersimpan permanen (filesystem Vercel bersifat sementara).
"""
import os
from datetime import date
from flask import Flask, jsonify, request, abort
from sqlalchemy import Column, Date, Float, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

url = os.getenv("DATABASE_URL") or (
    "sqlite:////tmp/finora.db" if os.getenv("VERCEL") else "sqlite:///finora.db"
)
if url.startswith("postgres://"):
    url = url.replace("postgres://", "postgresql://", 1)

engine = create_engine(url, pool_pre_ping=True)
Session = sessionmaker(bind=engine)
Base = declarative_base()


class Tx(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    type = Column(String(10), nullable=False)  # income | expense
    category = Column(String(50), nullable=False)
    amount = Column(Float, nullable=False)
    note = Column(String(200), default="")
    date = Column(Date, default=date.today)


class Budget(Base):
    __tablename__ = "budgets"
    id = Column(Integer, primary_key=True)
    category = Column(String(50), unique=True, nullable=False)
    amount = Column(Float, nullable=False)


class Goal(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    target = Column(Float, nullable=False)
    saved = Column(Float, default=0)


Base.metadata.create_all(engine)
MODELS = {"transactions": Tx, "budgets": Budget, "goals": Goal}
app = Flask(__name__)


def to_dict(o):
    out = {}
    for c in o.__table__.columns:
        v = getattr(o, c.name)
        out[c.name] = v.isoformat() if isinstance(v, date) else v
    return out


def parse(model, data):
    out = {}
    for c in model.__table__.columns:
        if c.name in data and c.name != "id":
            v = data[c.name]
            if isinstance(c.type, Date):
                v = date.fromisoformat(v)
            elif isinstance(c.type, Float):
                v = float(v)
            out[c.name] = v
    return out


def model_or_404(res):
    return MODELS.get(res) or abort(404)


@app.get("/api/stats")
def stats():
    month = request.args.get("month") or date.today().strftime("%Y-%m")
    with Session() as s:
        txs, budgets = s.query(Tx).all(), s.query(Budget).all()
    cur = [t for t in txs if t.date.strftime("%Y-%m") == month]
    cats, trend = {}, {}
    for t in cur:
        if t.type == "expense":
            cats[t.category] = cats.get(t.category, 0) + t.amount
    for t in txs:
        k = t.date.strftime("%Y-%m")
        trend.setdefault(k, {"month": k, "income": 0, "expense": 0})[t.type] += t.amount
    total_in = sum(t.amount for t in txs if t.type == "income")
    total_out = sum(t.amount for t in txs if t.type == "expense")
    return jsonify(
        balance=total_in - total_out,
        income=sum(t.amount for t in cur if t.type == "income"),
        expense=sum(cats.values()),
        categories=cats,
        trend=sorted(trend.values(), key=lambda r: r["month"])[-6:],
        budgets=[{**to_dict(b), "spent": cats.get(b.category, 0)} for b in budgets],
    )


@app.get("/api/<res>")
def list_items(res):
    M = model_or_404(res)
    with Session() as s:
        q = s.query(M).order_by(*( [M.date.desc(), M.id.desc()] if res == "transactions" else [M.id.desc()] ))
        return jsonify([to_dict(o) for o in q.all()])


@app.post("/api/<res>")
def create_item(res):
    M, data = model_or_404(res), request.get_json(force=True)
    try:
        values = parse(M, data)
        with Session() as s:
            obj = None
            if res == "budgets":  # satu anggaran per kategori (upsert)
                obj = s.query(M).filter_by(category=values["category"]).first()
            if obj:
                for k, v in values.items():
                    setattr(obj, k, v)
            else:
                obj = M(**values)
                s.add(obj)
            s.commit()
            return jsonify(to_dict(obj)), 201
    except (ValueError, KeyError, TypeError) as e:
        return jsonify(error=f"Data tidak valid: {e}"), 400


@app.put("/api/<res>/<int:id>")
def update_item(res, id):
    M = model_or_404(res)
    with Session() as s:
        obj = s.get(M, id) or abort(404)
        for k, v in parse(M, request.get_json(force=True)).items():
            setattr(obj, k, v)
        s.commit()
        return jsonify(to_dict(obj))


@app.delete("/api/<res>/<int:id>")
def delete_item(res, id):
    M = model_or_404(res)
    with Session() as s:
        obj = s.get(M, id) or abort(404)
        s.delete(obj)
        s.commit()
    return jsonify(ok=True)


if __name__ == "__main__":
    app.run(port=5000, debug=True)
