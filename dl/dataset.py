import os
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision.transforms import v2
from PIL import Image

def apply_uneven_illumination(img_tensor):
    """Simulates shadows and bright spots across the paper."""
    if torch.rand(1).item() > 0.5:
        _, h, w = img_tensor.shape
        y, x = torch.meshgrid(torch.linspace(-1, 1, h), torch.linspace(-1, 1, w), indexing='ij')
        gradient = x * 0.5 + y * 0.5
        illumination = (0.7 + 0.3 * gradient).clamp(0.4, 1.1).unsqueeze(0)
        img_tensor = img_tensor * illumination
    return img_tensor.clamp(0.0, 1.0)

# Physical degradation pipeline matching teammate's constraints
# Toned-down physical degradation to preserve micro-shifts
train_transforms = v2.Compose([
    v2.ToImage(), 
    
    # Increased minimum quality, dropped probability to 15%
    v2.RandomApply([v2.JPEG(quality=(60, 90))], p=0.15),
    
    v2.ToDtype(torch.float32, scale=True), 
    
    # Milder lighting variations
    v2.RandomApply([v2.ColorJitter(brightness=(0.7, 1.3), contrast=(0.8, 1.2))], p=0.3),
    v2.Lambda(apply_uneven_illumination),
    
    # Halved the perspective distortion scale
    v2.RandomPerspective(distortion_scale=0.15, p=0.2),
    
    # Blur is the ultimate enemy of spatial shifts. Restricted to a tiny 3x3 kernel.
    v2.RandomApply([v2.GaussianBlur(kernel_size=(3, 3), sigma=(0.1, 1.0))], p=0.15),
    
    # Reduced noise multiplier to 0.02
    v2.Lambda(lambda x: x + torch.randn_like(x) * 0.02 if torch.rand(1).item() > 0.8 else x),
    
    v2.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

val_transforms = v2.Compose([
    v2.ToImage(),
    v2.ToDtype(torch.float32, scale=True),
    v2.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

class TraceMarkCSVDataset(Dataset):
    def __init__(self, csv_file, img_dir, transform=None):
        self.annotations = pd.read_csv(csv_file)
        self.img_dir = img_dir
        self.transform = transform
        
        # Strip whitespace from column names just in case
        self.annotations.columns = self.annotations.columns.str.strip()
        
        # Dynamically find the correct column names
        cols = self.annotations.columns.tolist()
        
        # Find filename column (could be 'filename', 'image', 'patch_id', etc.)
        self.filename_col = next((col for col in cols if 'file' in col.lower() or 'image' in col.lower() or 'patch' in col.lower()), cols[0])
        
        # Find label column (could be 'label', 'shift', 'class', 'bit', etc.)
        self.label_col = next((col for col in cols if 'label' in col.lower() or 'class' in col.lower() or 'bit' in col.lower() or 'shift' in col.lower()), cols[-1])

    def __len__(self):
        return len(self.annotations)

    def __getitem__(self, index):
        img_id = str(self.annotations.iloc[index][self.filename_col])
        if not img_id.endswith(('.png', '.jpg', '.jpeg')):
            img_id = f"{img_id}.png"
            
        img_path = os.path.join(self.img_dir, img_id)
        image = Image.open(img_path).convert("RGB")
        
        # Extract the label using the dynamically found column
        y_label = torch.tensor(int(self.annotations.iloc[index][self.label_col]))

        if self.transform:
            image = self.transform(image)

        return image, y_label

class TransformSubset(Dataset):
    """Wrapper to apply specific transforms to a PyTorch Subset."""
    def __init__(self, subset, transform=None):
        self.subset = subset
        self.transform = transform

    def __getitem__(self, index):
        image, label = self.subset[index]
        if self.transform:
            image = self.transform(image)
        return image, label

    def __len__(self):
        return len(self.subset)

def get_dataloaders(data_dir="data", batch_size=16):
    """Splits the CSV dataset into 80/10/10 Train/Val/Test splits."""
    csv_path = os.path.join(data_dir, "labels.csv")
    patches_dir = os.path.join(data_dir, "patches")
    
    # Load base dataset WITHOUT transforms first
    base_dataset = TraceMarkCSVDataset(csv_file=csv_path, img_dir=patches_dir, transform=None)
    
    # Calculate 80% Train, 10% Val, 10% Test
    total_size = len(base_dataset)
    train_size = int(0.8 * total_size)
    val_size = int(0.1 * total_size)
    test_size = total_size - train_size - val_size
    
    # Split the dataset
    train_sub, val_sub, test_sub = torch.utils.data.random_split(
        base_dataset, [train_size, val_size, test_size]
    )
    
    # Apply transforms safely using the wrapper
    train_dataset = TransformSubset(train_sub, transform=train_transforms)
    val_dataset = TransformSubset(val_sub, transform=val_transforms)
    test_dataset = TransformSubset(test_sub, transform=val_transforms) # Test uses clean val transforms
    
    # num_workers=0 prevents RAM crashes on Windows
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    
    return train_loader, val_loader, test_loader