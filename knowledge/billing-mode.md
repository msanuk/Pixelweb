---
id: billing-mode
title: 包年包月与按量付费
aliases: [包年包月, 按量付费, 抢占式实例, Spot 实例, 预付费, 后付费, Savings Plans, 预留实例]
keywords: [计费方式, 退订, 停机不收费, on-demand]
category: cloud
level: 1
summary: 云资源的两种基本计费方式：包年包月先付钱、单价低，提前退订有损失；按量付费用多少扣多少、单价高，释放后停止计费。
related: [eip]
quiz:
  - q: 按量付费的云服务器「停机」后，还会扣费吗？
    options: [完全不再扣费, 云盘、公网 IP 等通常仍在计费, 自动按一半价格计费, 停机后会自动释放]
    answer: 1
    why: 停机最多停掉计算部分的费用（阿里云要开节省停机模式），云盘、公网 IP 照常计费；不用了要释放。
sources:
  - { title: "阿里云：ECS 计费概述", url: https://help.aliyun.com/zh/ecs/billing-overview }
  - { title: "AWS: Instance purchasing options", url: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-purchasing-options.html }
---
## 为什么重要
选错计费方式就是多花钱：长期跑的服务用按量付费贵不少；试用却买了包年包月，提前退订往往不能全额退。

## 在控制台里
试用、测试选按量付费，用完立刻释放；确定长期用再转包年包月。抢占式实例（AWS 叫 Spot）最便宜，但随时可能被回收，只适合能中断的任务。
