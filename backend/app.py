import asyncio
import json
import time

import pandas as pd
import joblib
from fastapi import FastAPI, WebSocket

CSV_PATH = "creditcard.csv"
LABEL_COL = "Class"

DEFAULT_DELAY_SEC = 0.12  # speed (0.12 ~ 8 tx/sec)

app = FastAPI()

model = None
feature_cols = None
df_cache = None
best_model_name = None


@app.on_event("startup")
def load_assets():
    global model, feature_cols, df_cache, best_model_name

    # Load trained artifacts
    model = joblib.load("best_model.pkl")                 # pipeline
    feature_cols = joblib.load("feature_cols.pkl")        # training columns
    best_model_name = joblib.load("best_model_name.pkl")  # model name

    # Load dataset
    df = pd.read_csv(CSV_PATH)

    # keep actual label for UI compare
    if LABEL_COL in df.columns:
        df["__label__"] = df[LABEL_COL].astype(int)
        df = df.drop(columns=[LABEL_COL])
    else:
        df["__label__"] = -1

    # Ensure columns exist
    missing = [c for c in feature_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns in dataset: {missing[:10]} ...")

    df_cache = df
    print(f"[BOOT] Loaded dataset rows={len(df_cache)} model={best_model_name}")


@app.get("/health")
def health():
    return {"status": "ok", "rows": len(df_cache), "model": str(best_model_name)}


@app.websocket("/ws/stream")
async def ws_stream(websocket: WebSocket):
    """
    Continuous loop:
      dataset row -> predict -> send -> sleep -> next row
      when end reached -> restart from 0 (replay forever)
    """
    await websocket.accept()
    print("[WS] connected")

    # client can send config after connect
    start = 0
    delay = DEFAULT_DELAY_SEC

    try:
        msg = await asyncio.wait_for(websocket.receive_text(), timeout=2.0)
        try:
            cfg = json.loads(msg)
            start = int(cfg.get("start", start))
            delay = float(cfg.get("delay", delay))
        except:
            pass
    except:
        pass

    i = start
    n = len(df_cache)

    while True:
        if i >= n:
            i = 0

        row = df_cache.iloc[i]
        actual = int(row["__label__"])

        feats = row[feature_cols].values.reshape(1, -1)

        # model is pipeline => predict_proba works directly
        score = float(model.predict_proba(feats)[0][1])
        pred = 1 if score >= 0.5 else 0

        payload = {
            "tx_id": f"TX-{i}",
            "ts": time.strftime("%Y-%m-%d %H:%M:%S"),
            "time_feature": float(row["Time"]) if "Time" in df_cache.columns else float(i),
            "amount": float(row["Amount"]) if "Amount" in df_cache.columns else 0.0,
            "score": score,
            "pred": pred,
            "actual": actual,
            # send all V-features (dataset values)
            "features": {c: float(row[c]) for c in feature_cols if c not in ["Time", "Amount"]},
        }

        try:
            await websocket.send_text(json.dumps(payload))
        except:
            print("[WS] disconnected")
            break

        i += 1
        await asyncio.sleep(delay)