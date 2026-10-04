---
id: subnet-cidr
title: 子网与 CIDR
aliases: [CIDR, 子网, subnet, 交换机, vSwitch, 网段, 子网掩码]
keywords: [IP 段, 私网地址]
category: cloud
level: 2
summary: CIDR 用「起始地址/前缀长度」写一段 IP，如 10.0.0.0/16；子网（阿里云叫交换机）是从 VPC 网段里切出来、落在某个可用区的一小段。
related: [vpc, region-zone]
quiz:
  - q: 10.0.0.0/24 这一段大约有多少个 IP 地址？
    options: [16 个, 256 个, 65536 个, 约 1600 万个]
    answer: 1
    why: /24 表示前 24 位固定，剩 8 位，2⁸ = 256；云厂商还会保留其中几个。
sources:
  - { title: "阿里云：专有网络与交换机", url: https://help.aliyun.com/zh/vpc/user-guide/create-and-manage-a-vpc }
  - { title: "AWS: VPC CIDR blocks", url: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html }
---
## 为什么重要
斜杠后的数字越大，地址越少：/16 约 6.5 万个，/24 只有 256 个。子网建在某个可用区里，云服务器选了哪个子网，就落在哪个可用区。

## 在控制台里
VPC 用私网网段（10.0.0.0/8、172.16.0.0/12、192.168.0.0/16 之内），子网切成 /24 左右。各子网不能重叠；将来要和公司内网打通，也别和公司网段重叠。
