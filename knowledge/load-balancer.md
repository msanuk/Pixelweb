---
id: load-balancer
title: 负载均衡
aliases: [load balancer, 负载均衡器, SLB, CLB, ALB, NLB, ELB]
keywords: [健康检查, 监听, 后端服务器, 七层, 四层]
category: cloud
level: 2
summary: 放在多台服务器前面的统一入口：按规则把请求分给后端，自动绕开健康检查失败的机器。
related: [eip, http]
quiz:
  - q: ALB（应用型）和 NLB（网络型）的主要区别是？
    options: [ALB 按 HTTP 内容转发，NLB 只看 TCP/UDP, ALB 只在阿里云有，NLB 只在 AWS 有, ALB 免费使用，NLB 按流量收费, 两者完全相同，只是名字不同]
    answer: 0
    why: ALB 工作在七层，能按域名、路径转发；NLB 在四层，只看连接。
sources:
  - { title: "阿里云：负载均衡类型怎么选", url: https://help.aliyun.com/zh/slb/product-overview/slb-overview }
  - { title: "AWS: What is Elastic Load Balancing?", url: https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html }
---
## 为什么重要
单台服务器挂了服务就断；负载均衡让多台一起扛流量，还能统一挂 HTTPS 证书。它本身也收费，只有一台机器时常常用不上。

## 在控制台里
网站和 API 选七层（ALB），按域名、路径转发；纯 TCP/UDP 服务选四层（NLB）。健康检查的路径和端口要和应用真实监听的一致。
