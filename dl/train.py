import os
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision.models import resnet18, ResNet18_Weights
from dataset import get_dataloaders

def train_model():
    os.makedirs("models", exist_ok=True)
    
    # Force GPU if available, otherwise CPU
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Initializing Training on: {device}")
    
    # BATCH SIZE 16: Keeps VRAM and RAM usage low
    train_loader, val_loader, test_loader = get_dataloaders(data_dir="data", batch_size=16)
    
    # Initialize ResNet-18
    model = resnet18(weights=ResNet18_Weights.DEFAULT)
    # Modify final layer for 2 classes (Shift Left = 0, Shift Right = 1)
    model.fc = nn.Linear(model.fc.in_features, 2)
    model = model.to(device)
    
    # Add class weights to combat the 69% / 31% imbalance trap
    class_weights = torch.tensor([0.31, 0.69]).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    
    # Lowered learning rate to prevent destroying pre-trained weights
    optimizer = optim.Adam(model.parameters(), lr=0.0001)
    
    # Increased to 10 epochs so the model can learn through the heavy noise
    epochs = 10  
    
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            
        # Validation Loop
        model.eval()
        val_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item()
                
                _, predicted = torch.max(outputs.data, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
                
        val_acc = 100 * correct / total
        print(f"Epoch [{epoch+1}/{epochs}] | Train Loss: {running_loss/len(train_loader):.4f} | Val Loss: {val_loss/len(val_loader):.4f} | Val Acc: {val_acc:.2f}%")

    # --- Lock and Save the Model ---
    save_path = "models/trace_mark_resnet18.pth"
    torch.save(model.state_dict(), save_path)
    
    # --- FINAL TEST SET EVALUATION ---
    model.eval()
    test_loss = 0.0
    test_correct = 0
    test_total = 0
    with torch.no_grad():
        for images, labels in test_loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)
            test_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            test_total += labels.size(0)
            test_correct += (predicted == labels).sum().item()
            
    test_acc = 100 * test_correct / test_total

    # Final Output Block for your Teammate
    print("\n" + "="*50)
    print("TRACE-MARK RESNET-18 TRAINING COMPLETE")
    print("="*50)
    print(f"Model File Saved : {save_path}")
    print(f"Total Patches    : {len(train_loader.dataset)} Train / {len(val_loader.dataset)} Val / {len(test_loader.dataset)} Test")
    print("Augmentations    : Low/Bright Light, Shadows, Blur, Perspective, JPEG, Noise")
    print(f"Final Test Loss  : {test_loss/len(test_loader):.4f}")
    print(f"Test Bit Accuracy: {test_acc:.2f}%")
    print(f"Test Error Rate  : {(100 - test_acc)/100:.4f}")
    print("="*50)
    
if __name__ == "__main__":
    train_model()