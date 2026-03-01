---
title: "树莓派 5 打造家庭实验室：Docker + Home Assistant 全攻略"
description: "利用 Raspberry Pi 5 搭建一个强大的家庭实验室，包含 Docker 容器管理、Home Assistant 智能家居、以及 Tailscale 内网穿透。"
date: 2026-02-20
tags: ["树莓派", "Docker", "智能家居", "HomeAssistant"]
cover: "/cover-raspberrypi.png"
---

Raspberry Pi 5 作为树莓派家族的最新旗舰，搭载了博通 BCM2712（四核 Cortex-A76 @ 2.4GHz），整体性能相较 Pi 4 提升了 2-3 倍，完全可以胜任家庭实验室（Homelab）的核心角色。

## 1. 系统安装

推荐使用 **Raspberry Pi Imager** 官方工具将 Raspberry Pi OS (64-bit) 烧录到 MicroSD 卡或者 NVMe SSD(需搭配 M.2 HAT)。

```bash
# 更新系统
sudo apt update && sudo apt full-upgrade -y

# 启用 SSH
sudo systemctl enable ssh
sudo systemctl start ssh
```

## 2. Docker 环境搭建

### 2.1 安装 Docker

```bash
# 一键安装 Docker
curl -fsSL https://get.docker.com | sh

# 将当前用户加入 docker 组（免 sudo）
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker run hello-world
```

### 2.2 安装 Docker Compose

```bash
sudo apt install -y docker-compose-plugin

# 验证
docker compose version
```

## 3. Home Assistant 部署

Home Assistant 是目前最流行的开源智能家居平台，通过 Docker 可以在 60 秒内完成部署。

```yaml
# docker-compose.yml
version: '3'
services:
  homeassistant:
    container_name: homeassistant
    image: ghcr.io/home-assistant/home-assistant:stable
    volumes:
      - ./ha-config:/config
      - /etc/localtime:/etc/localtime:ro
    restart: unless-stopped
    privileged: true
    network_mode: host
```

```bash
# 启动
docker compose up -d

# 访问 http://<树莓派IP>:8123 完成初始化
```

### 3.1 接入 Zigbee 设备

如果你使用 Sonoff Zigbee 3.0 USB Dongle Plus，可以通过 **Zigbee2MQTT** 插件接入各品牌的 Zigbee 设备（小米 Aqara、宜家 TRÅDFRI 等）。

## 4. Tailscale 内网穿透

为了从外网安全访问家里的 Home Assistant，推荐使用基于 WireGuard 的 Tailscale：

```bash
# 安装 Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 登录认证
sudo tailscale up

# 查看分配的 IP
tailscale ip -4
```

配置完成后，你可以在任何有网络的地方通过 Tailscale 分配的内网 IP 访问你的 Home Assistant 仪表盘，无需暴露公网端口。

## 5. 监控面板：Grafana + Prometheus

使用 Prometheus 收集系统指标，用 Grafana 做可视化展示：

```yaml
# 追加到 docker-compose.yml
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    restart: unless-stopped
    depends_on:
      - prometheus
```

## 6. 实用建议

- **供电**：使用官方 27W USB-C 电源适配器，避免因欠压导致的不稳定
- **散热**：推荐主动散热（官方散热外壳含风扇），长期运行下温度可控制在 55°C 以内
- **存储**：MicroSD 寿命有限，强烈建议用 NVMe SSD 做系统盘

> 树莓派 5 + Docker 是打造个人 Homelab 的最佳组合之一。一台小小的 Pi 就可以同时跑智能家居、网络监控、DNS 广告过滤（Pi-hole）以及各种自托管服务。
