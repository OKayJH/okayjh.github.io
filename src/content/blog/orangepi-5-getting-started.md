---
title: "香橙派 Orange Pi 5 上手指南：从开箱到系统部署"
description: "详细介绍香橙派 Orange Pi 5 开发板的硬件配置、系统烧录、基础环境搭建以及常见问题排查。"
date: 2026-02-25
tags: ["嵌入式", "Orange Pi", "RK3588S", "Linux"]
cover: "/cover-orangepi.png"
---

Orange Pi 5 是由深圳市迅龙软件有限公司（Shenzhen Xunlong Software）推出的一款高性能单板计算机，搭载瑞芯微 RK3588S 处理器，具备强大的 CPU、GPU 和 NPU 算力，是嵌入式开发和 AI 边缘计算的理想选择。

## 1. 硬件规格一览

| 参数 | 规格 |
|------|------|
| **SoC** | Rockchip RK3588S（四核 A76 + 四核 A55） |
| **GPU** | Mali-G610 MP4 |
| **NPU** | 6 TOPS (INT8) |
| **内存** | 4GB / 8GB / 16GB LPDDR4x |
| **存储** | MicroSD、eMMC 模块、M.2 NVMe SSD |
| **网络** | 千兆以太网、Wi-Fi 6 + BT 5.0（可选模块） |
| **接口** | HDMI 2.1、USB 3.0 ×1、USB 2.0 ×2、Type-C ×1、GPIO 26-pin |

## 2. 系统镜像烧录

### 2.1 下载官方镜像
前往 [Orange Pi 官方下载页](http://www.orangepi.cn/html/hardWare/computerAndMicrocontrollers/service-and-support/Orange-Pi-5.html) 获取最新的 Debian 或 Ubuntu 镜像。

### 2.2 使用 balenaEtcher 烧录

```bash
# Linux 下也可以用 dd 命令
sudo dd if=OrangePi5_Debian12.img of=/dev/sdX bs=4M status=progress
sync
```

推荐使用 balenaEtcher 图形化工具，操作过程非常直观：
1. 选择下载好的 `.img` 文件
2. 选择目标 MicroSD 卡（建议 Class 10 / A1 级别以上）
3. 点击 Flash 开始烧录

## 3. 首次启动与基础配置

将 SD 卡插入 Orange Pi 5 后接通电源，连接显示器和键盘即可进入系统。

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装常用开发工具
sudo apt install -y git vim build-essential python3-pip

# 查看 NPU 信息
cat /sys/class/devfreq/fdab0000.npu/cur_freq
```

### 3.1 设置固定 IP（便于 SSH 远程）

```bash
sudo nmcli con mod "Wired connection 1" \
  ipv4.addresses 192.168.1.100/24 \
  ipv4.gateway 192.168.1.1 \
  ipv4.dns "8.8.8.8" \
  ipv4.method manual

sudo nmcli con up "Wired connection 1"
```

## 4. GPIO 控制实战

Orange Pi 5 提供了 26-pin 的 GPIO 接口，与树莓派具有兼容性。使用 `wiringOP` 库可以快速进行 GPIO 实验：

```bash
# 安装 wiringOP
git clone https://github.com/orangepi-xunlong/wiringOP.git
cd wiringOP
sudo ./build clean && sudo ./build

# 查看 GPIO 引脚布局
gpio readall
```

```c
// blink.c - LED 闪烁示例
#include <wiringPi.h>
#include <stdio.h>

#define LED_PIN 0  // wPi 0 号引脚

int main(void) {
    wiringPiSetup();
    pinMode(LED_PIN, OUTPUT);

    while(1) {
        digitalWrite(LED_PIN, HIGH);
        delay(500);
        digitalWrite(LED_PIN, LOW);
        delay(500);
    }
    return 0;
}
```

## 5. 常见问题

- **无法点亮屏幕**：确保电源适配器功率不低于 5V/4A。RK3588S 对电源要求较高，低功率适配器会导致无法正常工作。
- **eMMC 与 SD 卡启动优先级**：默认 eMMC 优先，若要从 SD 卡启动需先擦除 eMMC。
- **Wi-Fi 无法连接**：部分镜像可能需要手动加载 `88x2cs` 无线模块驱动。

> 香橙派 5 是目前性价比最高的 RK3588S 平台之一，特别适合用于 AI 视觉推理、NAS 搭建以及轻量级服务器场景。
