---
title: "嵌入式 Linux 启动流程深度剖析：从上电到 Shell"
description: "从硬件上电复位开始，逐步解析 BootROM → SPL → U-Boot → Kernel → Rootfs → Init 的完整启动链路。"
date: 2026-02-15
tags: ["Linux", "嵌入式", "U-Boot", "启动流程"]
cover: "/cover-linux-embedded.png"
---

无论是瑞芯微 RK3588、全志 H616 还是 NXP i.MX8，所有基于 ARM 的嵌入式 Linux 系统都遵循一条相似的引导链路。理解这个流程，是嵌入式开发中最核心的基础知识。

## 1. 启动流程全景图

```
┌──────────┐
│  上电复位  │
└────┬─────┘
     ▼
┌──────────┐
│  BootROM  │  ← SoC 内部固化代码（不可修改）
└────┬─────┘
     ▼
┌──────────┐
│  SPL/TPL  │  ← 初始化 DRAM（DDR Training）
└────┬─────┘
     ▼
┌──────────┐
│  U-Boot   │  ← 加载内核和设备树
└────┬─────┘
     ▼
┌──────────┐
│  Kernel   │  ← Linux 内核初始化
└────┬─────┘
     ▼
┌──────────┐
│  Rootfs   │  ← 挂载根文件系统
└────┬─────┘
     ▼
┌──────────┐
│ Init/Shell│  ← systemd 或 BusyBox init
└──────────┘
```

## 2. BootROM 阶段

芯片上电后，CPU 首先从内部 ROM 加载固化的引导代码。BootROM 的职责非常有限：

1. 初始化最基本的时钟和 SRAM
2. 按照预设优先级扫描存储介质（eMMC → SD → SPI NOR → USB）
3. 把 SPL（Secondary Program Loader）加载到内部 SRAM 并跳转

以 RK3588 为例，BootROM 会在以下偏移量寻找 TPL/SPL：

```
eMMC:     Sector 64 (0x8000)
SD Card:  Sector 64 (0x8000)
SPI NOR:  Offset 0x0
```

## 3. SPL / TPL 阶段

SPL 是整个启动链中最关键的一环——它负责初始化 **DRAM**（DDR Training）。

在 RK3588 的 U-Boot SPL 中，典型的初始化流程：

```c
// arch/arm/mach-rockchip/spl.c
void board_init_f(ulong dummy)
{
    /* 初始化调试串口 */
    debug_uart_init();

    /* 初始化 DRAM (DDR4/LPDDR4x Training) */
    ret = sdram_init();

    /* 设置 U-Boot Proper 的加载地址 */
    spl_early_init();
}
```

> **DDR Training** 是一个自动化过程，硬件会调整 DQ 信号的采样窗口（Read/Write Leveling）以确保在高频下信号能被正确采样。如果此过程失败（通常表现为串口无输出），多半是 PCB 走线质量问题。

## 4. U-Boot 阶段

U-Boot 接管后，拥有了完整的 DRAM 和外设访问能力。核心任务：

1. 加载 Linux 内核镜像（`Image` 或 `zImage`）到 DRAM
2. 加载设备树文件（`.dtb`）
3. 设置 `bootargs` 内核命令行参数
4. 跳转到内核入口

```bash
# U-Boot 控制台常用命令

# 查看环境变量
printenv

# 手动从 eMMC 加载并启动
load mmc 0:1 0x00280000 Image
load mmc 0:1 0x00200000 rk3588s-orangepi-5.dtb
setenv bootargs "root=/dev/mmcblk0p2 rootwait console=ttyS2,1500000"
booti 0x00280000 - 0x00200000

# 保存环境变量到 eMMC
saveenv
```

### 4.1 设备树 (Device Tree) 的作用

设备树是一种描述硬件拓扑的数据结构，取代了内核源码中硬编码的板级信息。它以 `.dts`（源文件）编译为 `.dtb`（二进制）供内核解析。

```dts
// 一个简化的 LED 描述
/ {
    leds {
        compatible = "gpio-leds";
        user-led {
            gpios = <&gpio3 RK_PB5 GPIO_ACTIVE_HIGH>;
            label = "status";
            linux,default-trigger = "heartbeat";
        };
    };
};
```

## 5. Kernel 阶段

Linux 内核启动后的关键初始化步骤：

1. **`start_kernel()`** — 平台初始化入口
2. **内存管理子系统初始化** — 建立页表、启用 MMU
3. **设备驱动探测** — 根据设备树匹配并加载驱动
4. **挂载根文件系统** — 根据 `bootargs` 中的 `root=` 参数
5. **启动 Init 进程** — PID 1，通常是 `systemd` 或 `/sbin/init`

```bash
# 内核启动日志（节选）
[    0.000000] Booting Linux on physical CPU 0x0000000000 [0x412fd050]
[    0.000000] Linux version 5.10.160 (builder@lubancat) ...
[    1.234567] rk3588-pinctrl pinctrl: initialized OK
[    2.345678] EXT4-fs (mmcblk0p2): mounted filesystem
[    3.456789] Run /sbin/init as init process
```

## 6. 根文件系统与 Init

### 6.1 根文件系统类型

| 文件系统 | 特点 | 适用场景 |
|---------|------|---------|
| **ext4** | 通用、可读写 | 开发调试 |
| **squashfs** | 只读、高压缩率 | 量产固件 |
| **overlayfs** | squashfs + 可写层 | 兼顾安全与可写 |
| **initramfs** | 内存文件系统 | 早期引导 |

### 6.2 systemd vs BusyBox init

- **systemd**：功能全面（服务管理、日志、定时器等），适合复杂桌面/服务器系统
- **BusyBox init**：极度精简（几十 KB），适合资源受限的嵌入式场景

## 7. 调试技巧

- **串口不出字**：检查 TX/RX 是否反接、波特率是否正确（RK3588 一般为 1500000）
- **卡在 DDR Training**：PCB 走线问题或 DDR 颗粒兼容性问题
- **Kernel Panic**：多半是根文件系统挂载失败，检查 `bootargs` 中的 `root=` 参数
- **驱动未加载**：检查设备树中的 `status = "okay"` 和 `compatible` 字段匹配
