import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import average_precision_score, roc_auc_score

CSV_PATH = "creditcard.csv"
LABEL_COL = "Class"

def main():
    df = pd.read_csv(CSV_PATH)

    if LABEL_COL not in df.columns:
        raise ValueError(f"'{LABEL_COL}' column dataset lo ledu")

    X = df.drop(columns=[LABEL_COL])
    y = df[LABEL_COL].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    models = {
        "logreg_balanced": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=3000, class_weight="balanced"))
        ]),
        "rf_balanced": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", RandomForestClassifier(
                n_estimators=300,
                random_state=42,
                class_weight="balanced",
                n_jobs=-1
            ))
        ]),
    }

    best_name, best_ap, best_model = None, -1.0, None

    print("\nTraining models...\n")
    for name, model in models.items():
        model.fit(X_train, y_train)
        proba = model.predict_proba(X_test)[:, 1]
        ap = average_precision_score(y_test, proba)
        auc = roc_auc_score(y_test, proba)
        print(f"{name}: PR-AUC={ap:.6f}  ROC-AUC={auc:.6f}")
        if ap > best_ap:
            best_ap, best_name, best_model = ap, name, model

    print("\nBEST:", best_name, " PR-AUC=", best_ap)

    joblib.dump(best_model, "best_model.pkl")
    joblib.dump(list(X.columns), "feature_cols.pkl")
    joblib.dump(best_name, "best_model_name.pkl")

    print("Saved: best_model.pkl, feature_cols.pkl, best_model_name.pkl\n")

if __name__ == "__main__":
    main()