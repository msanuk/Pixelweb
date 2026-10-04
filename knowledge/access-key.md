---
id: access-key
title: AccessKey
aliases: [Access Key, AK/SK, 访问密钥, AccessKey Secret, Secret Access Key, STS]
keywords: [密钥, 凭证, credentials, 临时凭证]
category: cloud
level: 1
summary: 程序调用云 API 用的一对凭证：AccessKey ID 像用户名，Secret 像密码，拿到这一对就能以该身份操作云资源。
related: [ram-iam, environment-variable]
quiz:
  - q: 发现 AccessKey 被提交进了公开的 Git 仓库，第一步该做什么？
    options: [删掉那次提交就够了, 立刻禁用并轮换这个 AccessKey, 把仓库改成私有, 等账单异常了再处理]
    answer: 1
    why: 公开过就当作已经泄露：删提交、改私有都挡不住已经被抓走的副本。
sources:
  - { title: "阿里云：创建 AccessKey", url: https://help.aliyun.com/zh/ram/user-guide/create-an-accesskey-pair }
  - { title: "AWS: Manage access keys for IAM users", url: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html }
---
## 为什么重要
泄露的 AccessKey 会被自动扫描利用，常见后果是被拿去开机器挖矿、产生巨额账单。主账号的 AccessKey 等于整个账号，不要创建。

## 在控制台里
给 RAM / IAM 用户创建，只授必要权限；放在环境变量或密钥管理服务里，不进代码仓库。能用角色和临时凭证（STS）的地方就不用长期 AccessKey。
