"""
Fine-tune T5-small as the AssignAI Semantic Parser
====================================================
Trains a text-to-JSON model that converts natural language volunteer
constraints into the structured multi-group schema.

The model learns real semantics:
  "2 freshie females from CCE and 1 veteran male from CEE"
   {"groups":[{"count":2,"college":"CCE","gender":"F","new_old":"new"},
                {"count":1,"college":"CEE","gender":"M","new_old":"old"}]}

Usage:
  python fine_tune_semantic.py
  python fine_tune_semantic.py --epochs 5 --batch 16

Output:
  ./semantic_model/           fine-tuned T5 weights
  ./semantic_tokenizer/       matching tokenizer

Notes:
  - T5-small (60M params) trains in ~5 min on CPU with this dataset size.
  - First run downloads ~250 MB from HuggingFace (cached after that).
  - More epochs = better accuracy but more time. 3-5 is usually enough.
"""

import json
import argparse
import random
import os
from pathlib import Path

import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    T5ForConditionalGeneration,
    T5TokenizerFast,
    get_linear_schedule_with_warmup,
)
from torch.optim import AdamW

# 
# Config
# 

MODEL_NAME   = "t5-small"
DATA_PATH    = Path(__file__).parent / "semantic_training_data.jsonl"
MODEL_OUT    = Path(__file__).parent / "semantic_model"
TOK_OUT      = Path(__file__).parent / "semantic_tokenizer"
MAX_IN_LEN   = 128
MAX_OUT_LEN  = 256
VALID_SPLIT  = 0.1


# 
# Dataset
# 

class MultiTaskDataset(Dataset):
    """
    Multi-task dataset for T5 fine-tuning.
    Handles: constraint parsing, reply generation, and Q&A.
    Task prefixes are already in the training data.
    """

    def __init__(self, records, tokenizer):
        self.records   = records
        self.tokenizer = tokenizer

    def __len__(self):
        return len(self.records)

    def __getitem__(self, idx):
        rec   = self.records[idx]
        in_text  = rec["text"]  # No prefix addition - already in data
        out_text = rec["label"]

        enc = self.tokenizer(
            in_text,
            max_length=MAX_IN_LEN,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        dec = self.tokenizer(
            out_text,
            max_length=MAX_OUT_LEN,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        labels = dec["input_ids"].squeeze()
        labels[labels == self.tokenizer.pad_token_id] = -100  # ignore padding in loss

        return {
            "input_ids":      enc["input_ids"].squeeze(),
            "attention_mask": enc["attention_mask"].squeeze(),
            "labels":         labels,
        }


def load_data():
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Training data not found at {DATA_PATH}\n"
            "Run: python generate_semantic_data.py"
        )
    records = []
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    random.shuffle(records)
    split = int(len(records) * (1 - VALID_SPLIT))
    return records[:split], records[split:]


# 
# Training
# 

def train(epochs: int = 3, batch_size: int = 8, lr: float = 3e-4):
    print("=" * 60)
    print("AssignAI  Semantic Parser Fine-Tuning (T5-small)")
    print("=" * 60)

    # Load tokenizer + model (resume from checkpoint if available)
    checkpoint_exists = MODEL_OUT.exists() and (MODEL_OUT / "model.safetensors").exists()
    if checkpoint_exists:
        print(f"\n Resuming from checkpoint: {MODEL_OUT}")
        tokenizer = T5TokenizerFast.from_pretrained(str(TOK_OUT))
        model     = T5ForConditionalGeneration.from_pretrained(str(MODEL_OUT))
    else:
        print(f"\n Loading {MODEL_NAME} from HuggingFace")
        tokenizer = T5TokenizerFast.from_pretrained(MODEL_NAME)
        model     = T5ForConditionalGeneration.from_pretrained(MODEL_NAME)

    # Diagnose CUDA setup
    print(f"  PyTorch version: {torch.__version__}")
    print(f"  CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"  CUDA device: {torch.cuda.get_device_name(0)}")
        print(f"  CUDA version: {torch.version.cuda}")
    else:
        print("  ⚠️  CUDA not available! PyTorch was likely installed without CUDA support.")
        print("     Run: pip install torch --index-url https://download.pytorch.org/whl/cu121")
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Using device: {device}")
    model.to(device)

    # Load data
    print("\n Loading training data")
    train_recs, val_recs = load_data()
    print(f"   Train: {len(train_recs)} | Val: {len(val_recs)}")

    train_ds = MultiTaskDataset(train_recs, tokenizer)
    val_ds   = MultiTaskDataset(val_recs,   tokenizer)

    train_dl = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_dl   = DataLoader(val_ds,   batch_size=batch_size)

    # Optimizer + scheduler
    optimizer = AdamW(model.parameters(), lr=lr)
    total_steps = len(train_dl) * epochs
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=total_steps // 10,
        num_training_steps=total_steps,
    )

    # Training loop
    best_val_loss = float("inf")
    for epoch in range(1, epochs + 1):
        #  Train 
        model.train()
        train_loss = 0.0
        for step, batch in enumerate(train_dl, 1):
            input_ids      = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels         = batch["labels"].to(device)

            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels,
            )
            loss = outputs.loss
            loss.backward()

            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()

            train_loss += loss.item()
            if step % 50 == 0:
                avg = train_loss / step
                print(f"   Epoch {epoch} step {step}/{len(train_dl)}  loss={avg:.4f}")

        avg_train = train_loss / len(train_dl)

        #  Validate 
        model.eval()
        val_loss = 0.0
        exact_match = 0
        with torch.no_grad():
            for batch in val_dl:
                input_ids      = batch["input_ids"].to(device)
                attention_mask = batch["attention_mask"].to(device)
                labels         = batch["labels"].to(device)
                out = model(input_ids=input_ids, attention_mask=attention_mask, labels=labels)
                val_loss += out.loss.item()

            # Sample exact match on a few examples
            for rec in random.sample(val_recs, min(20, len(val_recs))):
                enc = tokenizer(
                    rec["text"],  # Prefix already in training data
                    return_tensors="pt", max_length=MAX_IN_LEN, truncation=True
                ).to(device)
                gen = model.generate(**enc, max_new_tokens=MAX_OUT_LEN)
                pred = tokenizer.decode(gen[0], skip_special_tokens=True).strip()
                try:
                    if json.loads(pred) == json.loads(rec["label"]):
                        exact_match += 1
                except Exception:
                    pass

        avg_val = val_loss / len(val_dl)
        em_pct  = exact_match / min(20, len(val_recs)) * 100
        print(f"\n Epoch {epoch}/{epochs}  train_loss={avg_train:.4f}  "
              f"val_loss={avg_val:.4f}  exact_match={em_pct:.0f}%\n")

        if avg_val < best_val_loss:
            best_val_loss = avg_val
            # Save to a temp dir first to avoid Windows file-lock errors
            # when the live service has model.safetensors memory-mapped.
            import tempfile, shutil
            with tempfile.TemporaryDirectory(dir=MODEL_OUT.parent) as tmp:
                tmp_model = Path(tmp) / "model"
                tmp_tok   = Path(tmp) / "tok"
                model.save_pretrained(tmp_model)
                tokenizer.save_pretrained(tmp_tok)
                # Atomic swap: remove old dirs, move new ones in
                if MODEL_OUT.exists():
                    shutil.rmtree(MODEL_OUT)
                shutil.copytree(tmp_model, MODEL_OUT)
                if TOK_OUT.exists():
                    shutil.rmtree(TOK_OUT)
                shutil.copytree(tmp_tok, TOK_OUT)
            print(f"    Saved best model  {MODEL_OUT}")

    print("\n Fine-tuning complete!")
    print(f"   Model: {MODEL_OUT}")
    print(f"   Tokenizer: {TOK_OUT}")
    print(f"   Best val loss: {best_val_loss:.4f}")
    print("\nTest it: python -c \"from semantic_parser import SemanticParser; "
          "p=SemanticParser(); print(p.parse('2 females from CCE and 1 male from CEE'))\"")


# 
# CLI
# 

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune T5-small semantic parser")
    parser.add_argument("--epochs", type=int,   default=3,    help="Training epochs (default 3)")
    parser.add_argument("--batch",  type=int,   default=8,    help="Batch size (default 8)")
    parser.add_argument("--lr",     type=float, default=3e-4, help="Learning rate (default 3e-4)")
    args = parser.parse_args()
    train(epochs=args.epochs, batch_size=args.batch, lr=args.lr)
