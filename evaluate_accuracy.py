import torch
import torch.nn as nn
from torchvision.models import resnet18
from dl.dataset import get_dataloaders

def check_accuracy(model_path="../models/trace_mark_resnet18_robust.pth"):
    # Adjust path if running directly from the root directory instead of dl/
    if not torch.cuda.is_available():
        device = torch.device("cpu")
    else:
        device = torch.device("cuda")
        
    print(f"Evaluating model on: {device}")

    # 1. Initialize architecture and load robust weights
    model = resnet18()
    model.fc = nn.Linear(model.fc.in_features, 2)
    
    try:
        model.load_state_dict(torch.load(model_path, map_location=device))
    except FileNotFoundError:
        model_path = "models/trace_mark_resnet18_robust.pth"
        model.load_state_dict(torch.load(model_path, map_location=device))
        
    model.to(device)
    model.eval() # Locks BatchNorm and Dropout layers for testing

    # 2. Load the validation dataset
    _, val_loader, _ = get_dataloaders(batch_size=32)

    correct = 0
    total = 0

    print("Running validation patches. Please wait...")

    # 3. Disable gradient calculations for speed and memory efficiency
    with torch.no_grad():
        for images, labels in val_loader:
            images, labels = images.to(device), labels.to(device)
            
            outputs = model(images)
            _, predicted = torch.max(outputs.data, 1)
            
            total += labels.size(0)
            correct += (predicted == labels).sum().item()

    accuracy = 100 * correct / total
    print(f"\nFinal Validation Accuracy: {accuracy:.2f}%")
    print(f"Correctly predicted {correct} out of {total} patches.")

if __name__ == "__main__":
    check_accuracy()