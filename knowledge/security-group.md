---
id: security-group
title: 安全组
aliases: [security group, 安全组规则, 入方向规则, 出方向规则, inbound rules, 0.0.0.0/0]
keywords: [防火墙, 放行, 端口白名单]
category: cloud
level: 1
summary: 套在云服务器外面的虚拟防火墙：按协议、端口和来源地址放行流量，没放行的入站请求进不来。
related: [vpc, localhost-port]
quiz:
  - q: 网站要让所有人访问、SSH 只给自己用，入方向规则怎么配？
    options: [80/443 和 22 都对 0.0.0.0/0 放行, 80/443 对 0.0.0.0/0，22 只对自己的 IP, 只放行 22，网站走内网访问, 所有端口只对自己的 IP 放行]
    answer: 1
    why: 对外服务的端口才对所有地址开放；管理端口只给可信来源。
sources:
  - { title: "阿里云：什么是安全组", url: https://help.aliyun.com/zh/ecs/user-guide/overview-44 }
  - { title: "AWS: Security groups", url: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html }
---
## 为什么重要
服务明明启动了、外面却连不上，多半是安全组没放行那个端口。反过来，22（SSH）、3306（MySQL）这类管理端口对 0.0.0.0/0（任何地址）放开，很快就会被扫描和爆破。

## 在控制台里
入方向只开对外服务的端口（如 80、443），管理端口只放行自己的 IP；出方向一般保持默认。
