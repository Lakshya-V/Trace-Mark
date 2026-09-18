import torch
import torch.nn as nn


class TraceMarkDecoder(nn.Module):
    """
    CNN that predicts ONE Trace-Mark bit from a local
    word-gap image patch.

    Input:
        [B, 1, 128, 128]

    Output:
        [B, 1] logits
    """

    def __init__(self):
        super().__init__()

        self.features = nn.Sequential(

            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),

            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),

            nn.AdaptiveAvgPool2d((4, 4))
        )

        self.classifier = nn.Sequential(
            nn.Flatten(),

            nn.Linear(256 * 4 * 4, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),

            nn.Linear(256, 1)
        )

    def forward(self, x):
        x = self.features(x)
        return self.classifier(x)


if __name__ == "__main__":

    print("Testing TraceMarkDecoder...")

    model = TraceMarkDecoder()

    x = torch.randn(4, 1, 128, 128)

    logits = model(x)

    print("Input shape :", tuple(x.shape))
    print("Output shape:", tuple(logits.shape))

    probabilities = torch.sigmoid(logits)
    predictions = (probabilities >= 0.5).float()

    print("Predictions:")
    print(predictions.squeeze(1).tolist())

    print()
    print("Decoder smoke test passed.")