---
id: ram-iam
title: RAM 与 IAM
aliases: [RAM 用户, RAM 角色, IAM 用户, IAM 角色, IAM, 主账号, 子账号]
keywords: [访问控制, 最小权限, 权限策略, policy, 实例角色]
category: cloud
level: 2
summary: 云厂商的身份与权限系统（阿里云叫 RAM，AWS 叫 IAM）：给人和程序各建身份，只授予用得到的权限，不直接用主账号。
related: [access-key, permission]
quiz:
  - q: 云服务器上的程序要读对象存储，哪种做法更安全？
    options: [把主账号 AccessKey 写进配置, 给实例绑定只读该存储的角色, 新建一个管理员权限的子账号, 把存储桶改成公共读写]
    answer: 1
    why: 角色给实例发自动轮换的临时凭证，权限也只限于那个存储。
sources:
  - { title: "阿里云：什么是访问控制 RAM", url: https://help.aliyun.com/zh/ram/product-overview/what-is-ram }
  - { title: "AWS: IAM roles", url: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html }
---
## 为什么重要
主账号（AWS 叫 root 用户）权限无限，一旦泄露整个账号都危险。日常登录用 RAM / IAM 用户，程序用角色或单独的用户，按最小权限授权。

## 在控制台里
给云服务器选「RAM 角色」（AWS 叫 IAM 实例配置文件），实例上的程序就能拿到临时凭证，代码里不用放 AccessKey。
