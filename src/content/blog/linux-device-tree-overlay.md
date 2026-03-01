---
title: "Linux 设备树 (Device Tree) 编写指南与 Overlay 实战"
description: "还在为修改 dts 文件而重新编译整个内核头疼吗？本文教你如何编写标准的 Device Tree 节点，并利用 DTO (Device Tree Overlay) 实现运行时硬件配置的热插拔与动态加载。"
date: 2026-03-01
tags: ["Linux", "嵌入式", "驱动开发", "设备树"]
cover: "/cover-devicetree.png"
---

在嵌入式 Linux 系统开发中，设备树（Device Tree）是描述硬件信息的核心机制。早期 ARM 架构 Linux 充斥着大量硬编码的板级文件 (`arch/arm/mach-*`)，不仅臃肿而且极难维护。直到 Linus Torvalds 发飙后，Device Tree 被引入，从此硬件描述和内核代码实现了解耦。

## 1. 什么是 Device Tree？

设备树本质上是一种数据结构，用节点（Nodes）和属性（Properties）来描述板子上的硬件连接关系：CPU、内存、外设总线、中断控制器等。

- **DTS (Device Tree Source)**：人类可读的文本格式。
- **DTSI (Device Tree Source Include)**：抽离出去的公共节点，类似于 C 语言的头文件，被多次引用。
- **DTC (Device Tree Compiler)**：将文本编译为二进制格式的工具。
- **DTB (Device Tree Blob)**：最终生成的二进制固件，由 Bootloader 传递给内核解析。

## 2. 编写一个典型的 I2C 传感器节点

假如我们在 I2C 总线上连接了一个 MPU6050 传感器，它的 DTS 节点应该如何描述？

```dts
&i2c1 {
    status = "okay";
    clock-frequency = <400000>;
    
    mpu6050@68 {
        compatible = "invensense,mpu6050";
        reg = <0x68>;
        interrupt-parent = <&gpio1>;
        interrupts = <24 IRQ_TYPE_EDGE_FALLING>;
    };
};
```

这里面几个重要的属性：
- **`status`**：`"okay"` 表示使能该外设，`"disabled"` 则反之。
- **`compatible`**：这是最关键的匹配依据。内核驱动通过这个字符串找到对应的硬件并绑定。
- **`reg`**：对于 I2C 设备，它代表了芯片的唯一的设备地址 `0x68`。
- **`interrupts`**：指明了该传感器使用哪一根 GPIO 作为中断脚，以及触发方式（下降沿触发）。

---

## 3. 什么是 Device Tree Overlay (DTO)？

过去，你每修改一次引脚复用或者挂载一个新外设，都需要重新执行 `make dtbs`，并将生成的 DTB 文件替换到系统的 boot 分区，然后重启板子。

对于像树莓派、香橙派这样接口极其丰富，且用户经常频繁插拔扩展板（HAT / Shield）的场景，传统的 DTB 机制十分低效。为了解决这个问题，**Device Tree Overlay (设备树动态覆盖机制)** 诞生了。

DTO 允许通过 `.dtbo` 后缀的补丁文件，在 Bootloader 阶段（甚至在 Linux 运行时使用 configfs）**动态覆盖或追加**原来的设备树节点，而不需要修改底层的 `base.dtb`。

### 3.1 编写一个简单的 DTO (/dts-v1/ /plugin/)

以下是一个通过 DTO 动态开启 UART3 并映射引脚的例子 `uart3-overlay.dts`：

```dts
/dts-v1/;
/plugin/;

/ {
    compatible = "rockchip,rk3588";

    fragment@0 {
        target = <&uart3>;
        __overlay__ {
            status = "okay";
            pinctrl-names = "default";
            pinctrl-0 = <&uart3m1_xfer>;
        };
    };
};
```

使用 `dtc` 进行编译：
```bash
dtc -@ -I dts -O dtb -o uart3.dtbo uart3-overlay.dts
```

然后利用板子的配置工具（如树莓派的 `dtoverlay=uart3` 或者是香橙派的 `orangepi-config`）加载这个 `.dtbo`，重启后就会生效。

## 4. 总结

熟练掌握 Device Tree 是做 Linux 驱动开发的敲门砖。从读懂芯片原厂极其臃肿的 `.dtsi`，到自己手写出外设节点，再到掌握 DTO 的动态加载魔法，能够极大地提升板级驱动的开发和调试效率。
