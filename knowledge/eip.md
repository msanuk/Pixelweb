---
id: eip
title: 公网 IP 与 EIP
aliases: [EIP, 弹性公网 IP, 弹性公网IP, Elastic IP, 弹性 IP, 公网 IP, 公网IP, 固定公网 IP]
keywords: [public IP, 带宽, 按使用流量, 按固定带宽]
category: cloud
level: 1
summary: 让云资源能被互联网访问的地址。随实例分配的公网 IP 跟着实例走；EIP（弹性公网 IP）可以单独持有，随时换绑到别的资源。
related: [security-group, billing-mode, load-balancer]
quiz:
  - q: 以后换服务器时想让域名指向的 IP 不变，该用哪种？
    options: [随实例分配的公网 IP, 弹性公网 IP（EIP）, 实例的私网 IP, 每次重新解析域名]
    answer: 1
    why: EIP 是独立的资源，解绑旧实例、绑到新实例，地址不变。
sources:
  - { title: "阿里云：什么是弹性公网 IP", url: https://help.aliyun.com/zh/eip/product-overview/what-is-eip }
  - { title: "AWS: Elastic IP addresses", url: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html }
---
## 为什么重要
没有公网 IP（也没有负载均衡或 NAT），外面访问不到这台机器，它也不能主动上网。公网 IP 和带宽通常单独计费，EIP 闲置不绑定时一般也收费。

## 在控制台里
带宽有「按固定带宽」和「按使用流量」两种计费，流量小、波动大选按流量（这时带宽值只是上限）。要长期固定的地址就用 EIP。
