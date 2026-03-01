---
title: "RK3588 NPU 模型部署与量化实战指南"
description: "本文详细介绍了如何在瑞芯微 RK3588 平台上部署深度学习模型，包括 rknn-toolkit2 的使用、量化策略以及板端 C++ API 推理代码编写。"
date: 2026-02-28
tags: ["AI", "RK3588", "NPU", "Tutorial"]
cover: "/avatar.jpg"
---

这是一篇关于在瑞芯微 RK3588 NPU 上部署深度学习模型（特别是 YOLO 系列）的实战教程。

## 1. 简介与背景

Rockchip RK3588 是一款高性能的 SoC，内置了强大的独立 NPU，算力高达 `6 TOPS`，非常适合边缘侧的人工智能推理计算。

为了充分利用该硬件加速能力，我们需要使用官方提供的 **RKNN-Toolkit2** 以及板端运行库 **RKNN-Toolkit-Lite2** (或 C++ Runtime)。这套工具链主要负责将各个主流框架（TensorFlow、PyTorch、ONNX 等）的模型进行转换与量化，最终生成能在 RK 芯片上独立运行的 `.rknn` 文件。

## 2. PC 端环境搭建与模型转换

### 2.1 安装 RKNN-Toolkit2
推荐在 Ubuntu (x86_64) 环境下或者直接使用原厂 Docker 镜像来配置。

```bash
# 创建 Conda 虚拟环境
conda create -n rknn python=3.8
conda activate rknn

# 安装依赖
pip install -r doc/requirements_cp38-1.5.0.txt

# 安装 rknn-toolkit2
pip install packages/rknn_toolkit2-1.5.0+1fa95b5c-cp38-cp38-linux_x86_64.whl
```

### 2.2 模型导出与转换 (以 YOLOv8 为例)

首先，你需要将原生的 PyTorch 模型转换为 `ONNX` 格式（注意在导出时建议去除后处理以便兼容 NPU 计算图）。
然后，编写 Python 转换脚本：

```python
from rknn.api import RKNN

# 1. 创建 RKNN 对象
rknn = RKNN(verbose=True)

# 2. 配置模型输入参数，推荐启用量化
rknn.config(mean_values=[[0, 0, 0]], std_values=[[255, 255, 255]], target_platform='rk3588')

# 3. 加载 ONNX 模型
ret = rknn.load_onnx(model='./yolov8s.onnx')

# 4. 构建模型 (传入量化校准数据集)
# 量化包含非对称量化(asymmetric)和动态定点量化，这可以显著提升 NPU 推理速度
ret = rknn.build(do_quantization=True, dataset='./dataset.txt')

# 5. 导出保存 RKNN 模型
ret = rknn.export_rknn('./yolov8s.rknn')

rknn.release()
```

## 3. 板端部署与推理测试

将生成的 `yolov8s.rknn` 传输至 RK3588 开发板。在板子上你可以选择 Python 接口 (`rknn-toolkit-lite2`) 或者基于 C/C++ 的 `rknpu2` API 进行高性能推理。

*注意：对于 YOLO 目标检测，务必检查后处理逻辑中 NMS (非极大值抑制) 的耗时。如果在 Python 端处理过慢，强烈建议使用 C++ 联合 OpenCV 实现多线程前/后处理流水线。*

> [!TIP]
> **关于量化掉点：**
> 如果转换定点模型 (INT8) 后发现量化精度下降严重，可以尝试在 `rknn.build` 中配置 `quantized_dtype='asymmetric_affine-u8'`，或者通过官方 Toolkit 分析每层的余弦距离 (Cosine Distance) 来排查敏感层，对这些层采用混合量化 (Mixed Quantization)。
