FINAL EXECUTION GUIDE (END-TO-END)
✅ STEP 0: Check Project Structure

Make sure your folders look like this:

fraud-streaming/
 ├── backend/
 │    ├── app.py
 │    ├── train.py
 │    ├── creditcard.csv
 │
 └── frontend/
      ├── src/
      │    ├── App.jsx
      │    ├── main.jsx
  <img width="1894" height="1092" alt="Screenshot 2026-04-01 154641" src="https://github.com/user-attachments/assets/b4ce0a36-4139-4853-a1c4-8655e976d1c7" />

🧠 STEP 1: Train the Model (Backend)

Open terminal:

cd C:\veera\fraud-streaming\backend
python train.py

✅ Expected output:

best_model.pkl
feature_cols.pkl
best_model_name.pkl

👉 These files store your trained model

⚙️ STEP 2: Run Backend Server
uvicorn app:app --port 8001

👉 Use port 8001 (avoids conflicts)

🌐 STEP 3: Test Backend API

Open in browser:

http://127.0.0.1:8001/health

✅ Expected:

{"status":"ok", ...}
🎨 STEP 4: Setup Frontend

Open new terminal:

cd C:\veera\fraud-streaming\frontend
🔧 STEP 5: Fix WebSocket URL (IMPORTANT)

Open file:

frontend/src/App.jsx

Find this line:

new WebSocket("ws://127.0.0.1:8000/ws/stream");

Change to:

new WebSocket("ws://127.0.0.1:8001/ws/stream");
▶️ STEP 6: Run Frontend
npm run dev

Open in browser:

http://localhost:5173
🎯 FINAL OUTPUT
🟢 Genuine Transaction:
Payment → SUCCESS
Green highlight
🔴 Fraud Transaction:
Payment → FAILED
Red highlight
🔁 Live Data:
Continuous streaming (real-time simulation)
⚡ DEBUG TEST (Optional)

Open browser console (F12) and run:

let ws = new WebSocket("ws://127.0.0.1:8001/ws/stream");
ws.onopen = () => console.log("OPEN");
ws.onmessage = (e) => console.log("DATA", e.data);

👉 If data prints continuously → everything is working ✅
