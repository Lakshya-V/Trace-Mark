import os
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from torchvision import models

from dataset import TraceMarkGapDataset


DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

BATCH_SIZE = 32
EPOCHS = 15
LR = 1e-4


def main():

    print("=" * 60)
    print("TRACE-MARK RESNET-18 TRAINING")
    print("=" * 60)

    print("Device:", DEVICE)

    # -------------------------
    # Dataset
    # -------------------------

    dataset = TraceMarkGapDataset(
        labels_csv="dataset/labels.csv"
    )

    print("Total samples:", len(dataset))

    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size

    train_set, val_set = random_split(
        dataset,
        [train_size, val_size],
        generator=torch.Generator().manual_seed(42)
    )

    print("Training samples:", len(train_set))
    print("Validation samples:", len(val_set))

    train_loader = DataLoader(
        train_set,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=0
    )

    val_loader = DataLoader(
        val_set,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=0
    )

    # -------------------------
    # ResNet-18
    # -------------------------

    print("Creating ResNet-18...")

    model = models.resnet18(weights=None)

    # Grayscale input: 1 channel
    model.conv1 = nn.Conv2d(
        1,
        64,
        kernel_size=7,
        stride=2,
        padding=3,
        bias=False
    )

    # Binary classification
    model.fc = nn.Linear(
        model.fc.in_features,
        1
    )

    model = model.to(DEVICE)

    print("Model ready.")

    # -------------------------
    # Calculate class balance
    # -------------------------

    positives = 0

    for i in range(len(dataset)):
        _, label = dataset[i]

        if label.item() == 1:
            positives += 1

    negatives = len(dataset) - positives

    print("Zero samples:", negatives)
    print("One samples :", positives)

    pos_weight = torch.tensor(
        [negatives / max(positives, 1)],
        device=DEVICE
    )

    print(
        "Positive class weight:",
        pos_weight.item()
    )

    criterion = nn.BCEWithLogitsLoss(
        pos_weight=pos_weight
    )

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=LR,
        weight_decay=1e-4
    )

    # -------------------------
    # Training
    # -------------------------

    for epoch in range(EPOCHS):

        model.train()

        total_loss = 0.0
        correct = 0
        total = 0

        for batch_idx, (images, labels) in enumerate(train_loader):

            images = images.to(DEVICE)
            labels = labels.float().to(DEVICE)

            optimizer.zero_grad()

            logits = model(images).squeeze(1)

            loss = criterion(
                logits,
                labels
            )

            loss.backward()

            optimizer.step()

            total_loss += loss.item()

            predictions = (
                torch.sigmoid(logits) >= 0.5
            ).float()

            correct += (
                predictions == labels
            ).sum().item()

            total += labels.size(0)

        train_acc = correct / total

        # -------------------------
        # Validation
        # -------------------------

        model.eval()

        val_correct = 0
        val_total = 0

        with torch.no_grad():

            for images, labels in val_loader:

                images = images.to(DEVICE)
                labels = labels.float().to(DEVICE)

                logits = model(images).squeeze(1)

                predictions = (
                    torch.sigmoid(logits) >= 0.5
                ).float()

                val_correct += (
                    predictions == labels
                ).sum().item()

                val_total += labels.size(0)

        val_acc = val_correct / val_total

        average_loss = total_loss / len(train_loader)

        print(
            f"Epoch {epoch + 1:02d}/{EPOCHS} | "
            f"Loss: {average_loss:.4f} | "
            f"Train Acc: {train_acc:.4f} | "
            f"Val Acc: {val_acc:.4f}"
        )

    # -------------------------
    # Save model
    # -------------------------

    os.makedirs("models", exist_ok=True)

    model_path = "models/trace_mark_resnet18.pth"

    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "model": "resnet18",
            "input_size": 128,
            "num_classes": 1
        },
        model_path
    )

    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)

    print("Model saved to:")
    print(model_path)


if __name__ == "__main__":
    main()