import os
import csv
import cv2
import torch
from torch.utils.data import Dataset


class TraceMarkGapDataset(Dataset):

    def __init__(self, labels_csv="dataset/labels.csv"):

        self.labels_csv = labels_csv

        self.root_dir = os.path.dirname(
            os.path.dirname(
                os.path.abspath(labels_csv)
            )
        )

        self.patch_dir = os.path.join(
            self.root_dir,
            "dataset",
            "patches"
        )

        self.samples = []

        with open(
            labels_csv,
            "r",
            encoding="utf-8"
        ) as f:

            reader = csv.DictReader(f)

            for row in reader:
                self.samples.append({
                    "filename": row["filename"],
                    "bit": int(row["bit"])
                })

        print(
            f"Loaded {len(self.samples)} samples"
        )

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):

        item = self.samples[index]

        path = os.path.join(
            self.patch_dir,
            item["filename"]
        )

        image = cv2.imread(
            path,
            cv2.IMREAD_GRAYSCALE
        )

        if image is None:
            raise RuntimeError(
                f"Could not read: {path}"
            )

        image = torch.from_numpy(
            image
        ).float() / 255.0

        # [H,W] -> [1,H,W]
        image = image.unsqueeze(0)

        label = torch.tensor(
            item["bit"],
            dtype=torch.float32
        )

        return image, label


if __name__ == "__main__":

    dataset = TraceMarkGapDataset()

    print("Dataset size:", len(dataset))

    image, label = dataset[0]

    print("Image shape:", image.shape)
    print("Label:", label.item())