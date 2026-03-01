---
title: "鲁班猫 4 RK3588S：Linux 系统定制与驱动开发入门"
description: "以野火鲁班猫 4 (LubanCat 4) 为例，介绍如何定制 Linux 系统、编译内核以及编写简单的字符设备驱动。"
date: 2026-02-22
tags: ["嵌入式", "鲁班猫", "Linux", "RK3588S"]
cover: "/cover-lubancat.png"
---

鲁班猫（LubanCat）是由深圳野火电子推出的高性能嵌入式开发板系列。其中 **鲁班猫 4** 搭载了 RK3588S 处理器，定位于工业级 AI 视觉应用和 Linux 系统学习。

## 1. 为什么选择鲁班猫？

与其他 RK3588 开发板相比，鲁班猫最大的优势在于**配套文档极其丰富**。野火官方提供了详尽的中文教程，涵盖了从 U-Boot 裁剪到 Linux 驱动开发的全流程。这对于嵌入式 Linux 学习者来说是非常友好的。

## 2. 系统镜像与烧录

### 2.1 获取 SDK
野火官方提供了完整的 Linux SDK，基于 Rockchip 原厂 SDK 进行了定制。

```bash
# 下载 SDK（约 20GB）
git clone https://gitee.com/LubanCat/lubancat_sdk.git
cd lubancat_sdk

# 同步子模块
git submodule update --init --recursive
```

### 2.2 编译系统镜像

```bash
# 选择板级配置
./build.sh lunch

# 全编译（包含 U-Boot、Kernel、Rootfs）
./build.sh all

# 单独编译内核
./build.sh kernel
```

## 3. Linux 内核定制

### 3.1 内核配置

```bash
cd kernel
# 进入 menuconfig 图形化配置界面
make ARCH=arm64 menuconfig

# 常见配置项：
# - Device Drivers → GPIO Support
# - Device Drivers → I2C Support
# - Device Drivers → SPI Support
# - Networking → Wireless (cfg80211/mac80211)
```

### 3.2 设备树修改

RK3588S 的设备树位于 `arch/arm64/boot/dts/rockchip/` 目录下。如果需要在 GPIO 上挂载一个自定义外设，可以这样修改：

```dts
// rk3588s-lubancat-4.dtsi 中新增节点
my_led {
    compatible = "gpio-leds";
    status = "okay";

    led0 {
        label = "user-led";
        gpios = <&gpio3 RK_PB5 GPIO_ACTIVE_HIGH>;
        default-state = "off";
    };
};
```

## 4. 字符设备驱动开发入门

以下是一个最精简的 Linux 字符设备驱动模板：

```c
#include <linux/module.h>
#include <linux/fs.h>
#include <linux/cdev.h>
#include <linux/uaccess.h>

#define DEVICE_NAME "hello_dev"
static dev_t dev_num;
static struct cdev hello_cdev;
static struct class *hello_class;

static int hello_open(struct inode *inode, struct file *filp) {
    printk(KERN_INFO "hello_dev: opened\n");
    return 0;
}

static ssize_t hello_read(struct file *filp, char __user *buf, size_t count, loff_t *ppos) {
    char msg[] = "Hello from LubanCat!\n";
    size_t len = sizeof(msg);
    if (*ppos >= len) return 0;
    if (copy_to_user(buf, msg, len)) return -EFAULT;
    *ppos += len;
    return len;
}

static struct file_operations fops = {
    .owner = THIS_MODULE,
    .open  = hello_open,
    .read  = hello_read,
};

static int __init hello_init(void) {
    alloc_chrdev_region(&dev_num, 0, 1, DEVICE_NAME);
    cdev_init(&hello_cdev, &fops);
    cdev_add(&hello_cdev, dev_num, 1);
    hello_class = class_create(THIS_MODULE, DEVICE_NAME);
    device_create(hello_class, NULL, dev_num, NULL, DEVICE_NAME);
    printk(KERN_INFO "hello_dev: registered\n");
    return 0;
}

static void __exit hello_exit(void) {
    device_destroy(hello_class, dev_num);
    class_destroy(hello_class);
    cdev_del(&hello_cdev);
    unregister_chrdev_region(dev_num, 0);
    printk(KERN_INFO "hello_dev: unregistered\n");
}

module_init(hello_init);
module_exit(hello_exit);
MODULE_LICENSE("GPL");
MODULE_AUTHOR("OKay");
```

### 编译与加载驱动

```bash
# Makefile
obj-m += hello_dev.o
KDIR := /path/to/lubancat_sdk/kernel

all:
	make -C $(KDIR) M=$(PWD) modules

# 推送到开发板并加载
scp hello_dev.ko cat@192.168.1.100:~/
ssh cat@192.168.1.100 "sudo insmod hello_dev.ko && cat /dev/hello_dev"
```

## 5. 总结

鲁班猫 4 是一块非常适合深度学习 Linux 嵌入式系统的开发板。从内核裁剪、设备树调试到驱动编写，整个工具链都已经打通。搭配野火出色的中文文档，能让你在嵌入式 Linux 的学习之路上事半功倍。
