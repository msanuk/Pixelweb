---
id: vpc
title: VPC（专有网络）
aliases: [VPC, 专有网络, 私有网络, Virtual Private Cloud]
keywords: [内网, 网络隔离]
category: cloud
level: 1
summary: 你在云上的一块私有网络：自己定网段，里面的资源走内网互通，和别人的资源默认隔离。
related: [subnet-cidr, security-group, region-zone]
quiz:
  - q: 同一地域、同一个 VPC 里的两台云服务器，通常怎么互相访问？
    options: [必须各配一个公网 IP, 用内网地址直接互通, 只能经负载均衡转发, 要先开通 VPN 隧道]
    answer: 1
    why: VPC 内的资源默认内网互通；要拦的话靠安全组。
sources:
  - { title: "阿里云：什么是专有网络 VPC", url: https://help.aliyun.com/zh/vpc/product-overview/what-is-a-vpc }
  - { title: "AWS: What is Amazon VPC?", url: https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html }
---
## 为什么重要
创建云服务器、数据库、负载均衡时都要先选 VPC。放在同一个 VPC 里才能用内网地址互相访问，延迟低、不占公网带宽；选错了，资源之间就只能绕公网。

## 在控制台里
新手用默认 VPC 即可。自己建时，主网段建好后不能改（只能追加），规划时留够地址，见「子网与 CIDR」。
