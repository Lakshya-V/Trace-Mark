"""
Trace-Mark Physical Channel Simulator

Simulates distortions that occur when a digitally encoded document
is printed and photographed with a smartphone.

Input:
    [B, 1, H, W] grayscale tensors in range [0, 1]

Output:
    distorted tensors in range [0, 1]

Designed to be used during decoder training.
"""

from __future__ import annotations

import torch
from torch import Tensor, nn
import torch.nn.functional as F


class PhysicalNoiseLayer(nn.Module):
    """
    Differentiable approximation of the print-camera channel.

    Simulates:
        - brightness variation
        - contrast variation
        - Gaussian noise
        - blur
        - small geometric distortions
        - shadows
        - resolution degradation
    """

    def __init__(
        self,
        noise_strength: float = 0.05,
        blur_probability: float = 0.5,
        geometry_probability: float = 0.5,
    ) -> None:
        super().__init__()

        self.noise_strength = noise_strength
        self.blur_probability = blur_probability
        self.geometry_probability = geometry_probability

    def _brightness_contrast(self, x: Tensor) -> Tensor:
        """Simulate uneven camera exposure."""

        batch_size = x.shape[0]

        brightness = (
            1.0
            + torch.empty(
                batch_size,
                1,
                1,
                1,
                device=x.device,
            ).uniform_(-0.12, 0.12)
        )

        contrast = (
            torch.empty(
                batch_size,
                1,
                1,
                1,
                device=x.device,
            ).uniform_(0.85, 1.15)
        )

        x = (x - 0.5) * contrast + 0.5
        x = x * brightness

        return x

    def _gaussian_noise(self, x: Tensor) -> Tensor:
        """Simulate smartphone sensor noise."""

        noise = torch.randn_like(x) * self.noise_strength

        return x + noise

    def _blur(self, x: Tensor) -> Tensor:
        """Simulate focus/motion blur."""

        if torch.rand(1, device=x.device).item() > self.blur_probability:
            return x

        kernel_size = 5
        sigma = 1.2

        coords = torch.arange(
            kernel_size,
            device=x.device,
            dtype=x.dtype,
        ) - kernel_size // 2

        kernel = torch.exp(-(coords ** 2) / (2 * sigma ** 2))
        kernel = kernel / kernel.sum()

        kernel_2d = kernel[:, None] * kernel[None, :]
        kernel_2d = kernel_2d.unsqueeze(0).unsqueeze(0)

        kernel_2d = kernel_2d.expand(
            x.shape[1],
            1,
            kernel_size,
            kernel_size,
        )

        return F.conv2d(
            x,
            kernel_2d,
            padding=kernel_size // 2,
            groups=x.shape[1],
        )

    def _resize_degradation(self, x: Tensor) -> Tensor:
        """Simulate limited camera resolution/compression."""

        if torch.rand(1, device=x.device).item() > 0.35:
            return x

        h, w = x.shape[-2:]

        small_h = max(h // 2, 32)
        small_w = max(w // 2, 32)

        x = F.interpolate(
            x,
            size=(small_h, small_w),
            mode="bilinear",
            align_corners=False,
        )

        x = F.interpolate(
            x,
            size=(h, w),
            mode="bilinear",
            align_corners=False,
        )

        return x

    def _geometry(self, x: Tensor) -> Tensor:
        """Simulate small camera perspective/position changes."""

        if torch.rand(1, device=x.device).item() > self.geometry_probability:
            return x

        batch_size = x.shape[0]
        device = x.device
        dtype = x.dtype

        # Small random affine transformation.
        angle = torch.empty(
            batch_size,
            device=device,
            dtype=dtype,
        ).uniform_(-4.0, 4.0)

        angle = angle * torch.pi / 180.0

        scale = torch.empty(
            batch_size,
            device=device,
            dtype=dtype,
        ).uniform_(0.97, 1.03)

        cos_a = torch.cos(angle) * scale
        sin_a = torch.sin(angle) * scale

        theta = torch.zeros(
            batch_size,
            2,
            3,
            device=device,
            dtype=dtype,
        )

        theta[:, 0, 0] = cos_a
        theta[:, 0, 1] = -sin_a
        theta[:, 1, 0] = sin_a
        theta[:, 1, 1] = cos_a

        # Small translation.
        theta[:, 0, 2] = torch.empty(
            batch_size,
            device=device,
            dtype=dtype,
        ).uniform_(-0.03, 0.03)

        theta[:, 1, 2] = torch.empty(
            batch_size,
            device=device,
            dtype=dtype,
        ).uniform_(-0.03, 0.03)

        grid = F.affine_grid(
            theta,
            x.size(),
            align_corners=False,
        )

        return F.grid_sample(
            x,
            grid,
            mode="bilinear",
            padding_mode="border",
            align_corners=False,
        )

    def _shadow(self, x: Tensor) -> Tensor:
        """Simulate uneven illumination/shadows."""

        batch_size, _, h, w = x.shape

        yy = torch.linspace(
            -1,
            1,
            h,
            device=x.device,
            dtype=x.dtype,
        ).view(1, 1, h, 1)

        xx = torch.linspace(
            -1,
            1,
            w,
            device=x.device,
            dtype=x.dtype,
        ).view(1, 1, 1, w)

        center_x = torch.empty(
            batch_size,
            1,
            1,
            1,
            device=x.device,
            dtype=x.dtype,
        ).uniform_(-0.5, 0.5)

        center_y = torch.empty(
            batch_size,
            1,
            1,
            1,
            device=x.device,
            dtype=x.dtype,
        ).uniform_(-0.5, 0.5)

        distance = torch.sqrt(
            (xx - center_x) ** 2 +
            (yy - center_y) ** 2
        )

        illumination = 1.0 - 0.18 * distance

        return x * illumination

    def forward(self, x: Tensor) -> Tensor:
        """Apply a random physical-camera degradation pipeline."""

        if x.ndim != 4:
            raise ValueError(
                f"Expected [B, C, H, W], got {tuple(x.shape)}"
            )

        if x.shape[1] != 1:
            raise ValueError(
                "PhysicalNoiseLayer expects grayscale input."
            )

        x = x.float().clamp(0.0, 1.0)

        # Randomize the order slightly by applying the main effects.
        x = self._geometry(x)
        x = self._brightness_contrast(x)
        x = self._shadow(x)
        x = self._blur(x)
        x = self._resize_degradation(x)
        x = self._gaussian_noise(x)

        return x.clamp(0.0, 1.0)


if __name__ == "__main__":
    print("Testing Trace-Mark PhysicalNoiseLayer...")

    # Fake grayscale document patches.
    images = torch.rand(4, 1, 128, 128)

    noise = PhysicalNoiseLayer()

    distorted = noise(images)

    print("Input shape:     ", tuple(images.shape))
    print("Output shape:    ", tuple(distorted.shape))
    print("Input range:     ", images.min().item(), "to", images.max().item())
    print("Output range:    ", distorted.min().item(), "to", distorted.max().item())

    print("Physical noise test passed.")