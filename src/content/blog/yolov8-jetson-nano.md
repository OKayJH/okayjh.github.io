---
title: "NVIDIA Jetson Nano 实战：部署 YOLOv8 实现实时目标检测"
description: "还在为边缘端 AI 算力不足发愁？本文手把手教你利用 Jetson Nano 的 Maxwell GPU，结合 TensorRT 加速引擎，将强大的 YOLOv8 模型部署到边缘设备，实现 30FPS+ 的实时目标检测。"
date: 2026-03-02
tags: ["AI", "边缘计算", "开发板", "YOLOv8", "Jetson"]
cover: "/cover-yolov8-jetson.png"
---

边缘计算的需求日益增长，将 AI 从云端推向边缘已经成为行业的趋势。在所有的边缘 AI 开发板中，NVIDIA Jetson 系列因为拥有 CUDA 生态的加持，成为了开发者眼中的香饽饽。

在这篇文章中，我们将完整地演示：如何在经典的算力板子——Jetson Nano 4GB 开发板上，使用 TensorRT 完整部署目前最火热的检测模型 **YOLOv8**。

## 1. 为什么选择 TensorRT？

Jetson Nano 的算力（0.47 TFLOPS）在今天看来并不算很强，如果直接在上面跑 PyTorch 的 YOLOv8 模型，你会绝望地看到帧率只有 `2~3 FPS`，延迟极高，完全无法进行“实时”检测。

**TensorRT** 是 NVIDIA 提供的一个高性能深度学习推理优化器。它能读取你训练好的网络结构，结合板载的确切 GPU 架构，执行以下激进的图优化操作：
- **层间融合 (Layer Fusion)**：合并连续的卷积、偏置和激活层。
- **混合精度压缩**：将 FP32 的权重极致地量化为 FP16 甚至是 INT8，直接带来几倍的吞吐量提升。

在使用了 TensorRT 加速后，Nano 跑 YOLOv8n (Nano版) 模型完全可以达到 **30+ FPS** 流畅运行的级别！

## 2. 导出 ONNX 模型

在你的高性能 PC（或者云端服务器）上，先将 YOLOv8 的 PyTorch 权重导出为跨平台的 `ONNX` 格式。

```bash
pip install ultralytics

# 命令行直出 onnx
yolo export model=yolov8n.pt format=onnx simplify=True imgsz=640
```

拿到 `yolov8n.onnx` 文件后，我们就可以把它用 U盘 或者 SSH 拷贝到开发板上了。

---

## 3. 在开发板上编译 TensorRT 引擎

登录 Jetson Nano 并进入终端。首先确保你通过 JetPack SDK 安装了完整版的 TensorRT 环境。

利用 NVIDIA 官方的万能打磨机 `trtexec`：
```bash
/usr/src/tensorrt/bin/trtexec --onnx=yolov8n.onnx \
                              --saveEngine=yolov8n.engine \
                              --fp16 \
                              --workspace=2048
```
上面的 `fp16` 参数非常重要，如果不开启 FP16 加速，Jetson 的 GPU 潜力就被白白浪费了。等待 5~10 分钟后（编译非常耗时），你将得到一个神级性能加持的 `.engine` 文件。

## 4. 编写 C++ 推理代码与拉取视频流

使用 TensorRT 的 C++ API（或者 Python API，视项目性能压榨程度而定）加载该引擎文件，然后连接一个普通的 USB 摄像头或是 MIPI CSI 摄像头。

**最终结果：** 街边的人、汽车、路标等都能被瞬间框选识别，这就是硬件加速的魅力。如果在未来，你需要应用在自动驾驶小车、智能门禁或者工业缺陷检测上，这块小小的开发板同样可以胜任。
