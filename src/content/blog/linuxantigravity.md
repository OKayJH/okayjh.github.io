---
title: "Linux安装Antigravity"
date: 2026-03-04
description: "在Windows的Antigravity用SSH连接到Linux时无法使用Agent，所以在UbuntuPC或虚拟机下载安装Antigravity"
tags:
  - Linux
cover: "/images/uploads/cover-1772591623155.png"
draft: false
---
# Linux安装Antigravity

## 创建存放密钥的目录
```
sudo mkdir -p /etc/apt/keyrings
```

## 下载并转换签名密钥
```
curl -fsSL https://us-central1-apt.pkg.dev/doc/repo-signing-key.gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/antigravity-repo-key.gpg
```

## 将仓库地址添加到系统源列表中
```
echo "deb [signed-by=/etc/apt/keyrings/antigravity-repo-key.gpg] https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev/ antigravity-debian main" | sudo tee /etc/apt/sources.list.d/antigravity.list > /dev/null
```

## 更新软件包索引
需要配置代理，光用Ubuntu上的Clash很难成功
找到Clash的端口号
![image](/images/uploads/paste-1772591781078.png)

```
sudo env http_proxy=http://127.0.0.1:7897 https_proxy=http://127.0.0.1:7897 apt update
```

## 安装
```
sudo env http_proxy=http://127.0.0.1:7897 https_proxy=http://127.0.0.1:7897 apt install antigravity
```
![image](/images/uploads/paste-1772591815835.png)