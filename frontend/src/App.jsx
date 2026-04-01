import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const startedRef = useRef(false);

  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [connected, setConnected] = useState(false);

  // backend loops forever
  const STREAM_CFG = useMemo(() => ({ start: 0, delay: 0.12 }), []);

  const stats = useMemo(() => {
    let fraud = 0, genuine = 0, failed = 0, success = 0;
    for (const r of rows) {
      const isFraud = (r?.score ?? 0) >= 0.5;
      if (isFraud) { fraud++; failed++; }
      else { genuine++; success++; }
    }
    return { total: rows.length, fraud, genuine, failed, success };
  }, [rows]);

  const formatINR = (n) => {
    const num = Number(n);
    if (Number.isNaN(num)) return "-";
    return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  };

  const scheduleReconnect = () => {
    if (reconnectRef.current) return;
    reconnectRef.current = setTimeout(() => {
      reconnectRef.current = null;
      connect();
    }, 800);
  };

  const connect = () => {
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;

    const ws = new WebSocket("ws://127.0.0.1:8000/ws/stream");
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify(STREAM_CFG));
    };

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);

      setRows((prev) => [msg, ...prev].slice(0, 180));
      setSelected((cur) => cur ?? msg);
    };

    ws.onerror = () => { setConnected(false); scheduleReconnect(); };
    ws.onclose = () => { setConnected(false); scheduleReconnect(); };
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    connect();
    return () => {
      try { if (reconnectRef.current) clearTimeout(reconnectRef.current); } catch {}
      try { wsRef.current?.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFraud = (r) => (r?.score ?? 0) >= 0.5;

  const DecisionBadge = ({ score }) => {
    const fraud = (score ?? 0) >= 0.5;
    return (
      <span className={`badge ${fraud ? "bad" : "good"}`}>
        {fraud ? "FRAUD" : "GENUINE"}
      </span>
    );
  };

  // ✅ Payment status = FAIL if fraud
  const PaymentBadge = ({ score }) => {
    const fraud = (score ?? 0) >= 0.5;
    return (
      <span className={`pay ${fraud ? "fail" : "ok"}`}>
        {fraud ? "FAILED" : "SUCCESS"}
      </span>
    );
  };

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div className="title">Fraud Detection Dashboard</div>
          {/* ✅ removed subtitle line as you asked */}
        </div>

        <div className={`conn ${connected ? "on" : "off"}`}>
          <span className="dot" />
          {connected ? "LIVE" : "RECONNECTING"}
        </div>
      </div>

      <div className="content">
        <div className="kpis">
          <Kpi label="Total (shown)" value={stats.total} hint="latest 180 tx" />
          <Kpi label="SUCCESS" value={stats.success} hint="payment allowed" />
          <Kpi label="FAILED" value={stats.failed} hint="blocked by model" danger />
        </div>

        <div className="grid">
          {/* Table */}
          <div className="card">
            <div className="cardHead">
              <div>
                <div className="h">Live Transactions</div>
                <div className="s">Fraud detected → transaction failed (declined)</div>
              </div>
              <div className="pill">Realtime Monitor</div>
            </div>

            <div className="tableWrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>TX</th>
                    <th>TS</th>
                    <th className="right">Time</th>
                    <th className="right">Amount</th>
                    <th className="right">Score</th>
                    <th>Decision</th>
                    <th>Payment</th>
                    <th>Actual</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan="8" className="empty">Waiting for stream…</td></tr>
                  )}

                  {rows.map((r) => {
                    const sel = selected?.tx_id === r.tx_id;
                    const fraud = isFraud(r);

                    return (
                      <tr
                        key={r.tx_id}
                        className={`${fraud ? "rowFraud" : "rowOk"} ${sel ? "rowSel" : ""}`}
                        onClick={() => setSelected(r)}
                      >
                        <td className="mono">{r.tx_id}</td>
                        <td className="muted">{r.ts}</td>
                        <td className="right mono">{Number(r.time_feature).toFixed(0)}</td>
                        <td className={`right amt ${fraud ? "amtBad" : ""}`}>{formatINR(r.amount)}</td>
                        <td className="right mono">{Number(r.score).toFixed(4)}</td>
                        <td><DecisionBadge score={r.score} /></td>
                        <td><PaymentBadge score={r.score} /></td>
                        <td className="mono">{r.actual === -1 ? "-" : (r.actual === 1 ? "FRAUD" : "GENUINE")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side Panel */}
          <div className="side">
            <div className="sideCard">
              <div className="sideHead">
                <div className="h">Transaction Details</div>
                <div className="s">Full feature view</div>
              </div>

              {!selected ? (
                <div className="sideEmpty">Select a row from table.</div>
              ) : (
                <div className="details">
                  <div className="detailTop">
                    <div className="bigMono">{selected.tx_id}</div>
                    <div className="badges">
                      <DecisionBadge score={selected.score} />
                      <PaymentBadge score={selected.score} />
                    </div>
                  </div>

                  {/* ✅ Fraud => show declined banner */}
                  {isFraud(selected) ? (
                    <div className="alert">
                      <div className="alertTitle">Payment Declined</div>
                      <div className="alertText">
                        High fraud risk detected (score ≥ 0.50). Transaction marked as <b>FAILED</b>.
                      </div>
                    </div>
                  ) : (
                    <div className="okbox">
                      <div className="okTitle">Payment Approved</div>
                      <div className="okText">
                        Low fraud risk (score &lt; 0.50). Transaction marked as <b>SUCCESS</b>.
                      </div>
                    </div>
                  )}

                  <div className="kv">
                    <Krow label="Time" value={String(selected.time_feature)} mono />
                    <Krow label="Amount" value={formatINR(selected.amount)} />
                    <Krow label="Fraud Score" value={Number(selected.score).toFixed(6)} mono />
                    <Krow label="Decision" value={isFraud(selected) ? "FRAUD" : "GENUINE"} />
                    <Krow label="Payment Status" value={isFraud(selected) ? "FAILED" : "SUCCESS"} />
                    <Krow label="Actual (dataset)" value={selected.actual === -1 ? "-" : (selected.actual === 1 ? "FRAUD" : "GENUINE")} />
                  </div>

                  <div className="featureBox">
                    {Object.entries(selected.features || {}).map(([k, v]) => (
                      <div className="feat" key={k}>
                        <span className="featK">{k}</span>
                        <span className="featV mono">{Number(v).toFixed(6)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="note">
                    Decision is based on model score (threshold 0.50). Fraud ⇒ payment failed.
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <style>{css}</style>
    </div>
  );
}

function Kpi({ label, value, hint, danger }) {
  return (
    <div className={`kpi ${danger ? "kpiDanger" : ""}`}>
      <div className="kpiLabel">{label}</div>
      <div className="kpiValue">{value}</div>
      <div className="kpiHint">{hint}</div>
    </div>
  );
}

function Krow({ label, value, mono }) {
  return (
    <div className="krow">
      <div className="klabel">{label}</div>
      <div className={`kvalue ${mono ? "mono" : ""}`}>{value ?? "-"}</div>
    </div>
  );
}

const css = `
  *{ box-sizing:border-box; }
  body{ margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f7f8fb; color:#111827; }
  .page{ min-height:100vh; }

  .topbar{
    position: sticky; top:0; z-index:10;
    display:flex; justify-content:space-between; align-items:center;
    padding:14px 18px;
    background:#ffffffcc;
    backdrop-filter: blur(10px);
    border-bottom:1px solid #e8eaf0;
  }
  .title{ font-weight:950; font-size:16px; }

  .conn{ display:flex; align-items:center; gap:8px; border:1px solid #e5e7eb; padding:8px 10px; border-radius:999px; font-weight:950; font-size:12px; background:#fff; }
  .conn .dot{ width:8px; height:8px; border-radius:999px; }
  .conn.on .dot{ background:#16a34a; }
  .conn.off .dot{ background:#f59e0b; }

  .content{ max-width:1320px; margin:0 auto; padding:18px; }

  .kpis{ display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:12px; margin-bottom:12px; }
  .kpi{ background:#fff; border:1px solid #e8eaf0; border-radius:14px; padding:14px; box-shadow: 0 10px 24px rgba(17,24,39,.06); }
  .kpiDanger{ border-color:#fecdd3; background:#fff7f8; }
  .kpiLabel{ color:#6b7280; font-size:12px; font-weight:900; }
  .kpiValue{ margin-top:6px; font-size:20px; font-weight:1000; }
  .kpiHint{ margin-top:6px; color:#9ca3af; font-size:12px; }

  .grid{ display:grid; grid-template-columns: 1.55fr 1fr; gap:12px; align-items:start; }
  .card, .sideCard{ background:#fff; border:1px solid #e8eaf0; border-radius:14px; box-shadow: 0 10px 24px rgba(17,24,39,.06); overflow:hidden; }
  .cardHead, .sideHead{ display:flex; justify-content:space-between; align-items:flex-end; padding:14px 16px; border-bottom:1px solid #eef0f3; }
  .h{ font-size:14px; font-weight:1000; }
  .s{ margin-top:3px; font-size:12.5px; color:#6b7280; }
  .pill{ font-size:12px; font-weight:900; background:#f3f4f6; border:1px solid #e5e7eb; padding:7px 10px; border-radius:999px; color:#374151; }

  .tableWrap{ overflow:auto; max-height:560px; }
  .tbl{ width:100%; min-width: 980px; border-collapse: collapse; }
  thead th{ position: sticky; top:0; z-index:2; background:#fbfbfd; border-bottom:1px solid #e5e7eb; text-align:left; padding:12px 14px; font-size:12px; color:#374151; }
  tbody td{ padding:12px 14px; border-bottom:1px solid #f0f2f5; font-size:13.5px; white-space:nowrap; cursor:pointer; }
  tbody tr:hover{ background:#f9fafb; }

  .rowFraud{ background:#fff1f2; }
  .rowOk{ background:#fff; }
  .rowSel{ outline: 2px solid rgba(17,24,39,.18); outline-offset:-2px; }

  .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
  .muted{ color:#6b7280; }
  .right{ text-align:right; }
  .amt{ font-weight:1000; }
  .amtBad{ color:#9f1239; }

  .badge{ display:inline-block; font-size:12px; font-weight:1000; padding:6px 10px; border-radius:999px; border:1px solid #e5e7eb; }
  .badge.good{ background:#ecfdf5; border-color:#a7f3d0; color:#065f46; }
  .badge.bad{ background:#fff1f2; border-color:#fecdd3; color:#9f1239; }

  .pay{ display:inline-block; font-size:12px; font-weight:1000; padding:6px 10px; border-radius:10px; border:1px solid #e5e7eb; }
  .pay.ok{ background:#eef2ff; border-color:#c7d2fe; color:#1e3a8a; }
  .pay.fail{ background:#fee2e2; border-color:#fecaca; color:#991b1b; }

  .empty{ text-align:center; padding:22px !important; color:#6b7280; cursor: default; }

  .side{ position: sticky; top: 62px; }
  .sideEmpty{ padding:18px; color:#6b7280; }
  .details{ padding:16px; }
  .detailTop{ display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
  .bigMono{ font-weight:1000; font-size:14px; }
  .badges{ display:flex; gap:8px; align-items:center; }

  .alert{
    border:1px solid #fecaca;
    background:#fff1f2;
    border-radius:12px;
    padding:12px;
    margin-bottom:12px;
  }
  .alertTitle{ font-weight:1000; color:#9f1239; }
  .alertText{ color:#6b7280; margin-top:4px; font-size:12.5px; }

  .okbox{
    border:1px solid #a7f3d0;
    background:#ecfdf5;
    border-radius:12px;
    padding:12px;
    margin-bottom:12px;
  }
  .okTitle{ font-weight:1000; color:#065f46; }
  .okText{ color:#6b7280; margin-top:4px; font-size:12.5px; }

  .kv{ display:grid; grid-template-columns:1fr; gap:10px; margin-top:10px; }
  .krow{ display:flex; justify-content:space-between; gap:12px; padding:10px 12px; border:1px solid #eef0f3; border-radius:12px; background:#fbfbfd; }
  .klabel{ color:#6b7280; font-size:12px; font-weight:900; }
  .kvalue{ font-size:13px; font-weight:900; color:#111827; text-align:right; }

  .featureBox{
    margin-top:12px;
    border:1px solid #eef0f3;
    border-radius:12px;
    background:#ffffff;
    max-height: 340px;
    overflow:auto;
  }
  .feat{ display:flex; justify-content:space-between; padding:10px 12px; border-bottom:1px solid #f0f2f5; }
  .featK{ font-weight:900; color:#374151; }
  .featV{ color:#111827; }

  .note{ margin-top:12px; color:#6b7280; font-size:12.5px; line-height:1.35; }

  @media (max-width:1100px){
    .kpis{ grid-template-columns: repeat(2, minmax(0,1fr)); }
    .grid{ grid-template-columns: 1fr; }
    .side{ position: static; }
  }
`;