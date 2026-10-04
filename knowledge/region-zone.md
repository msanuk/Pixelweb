---
id: region-zone
title: 地域与可用区
aliases: [地域, 可用区, Availability Zone, AZ]
keywords: [region, zone, 机房]
category: cloud
level: 1
summary: 地域（Region）是云厂商机房所在的城市或地区，如华东1（杭州）；可用区是同一地域里电力和网络相互独立的机房。
related: [vpc, subnet-cidr]
quiz:
  - q: 资源创建好以后想换到别的地域，通常怎么做？
    options: [在实例详情里直接改地域, 在新地域重新创建并迁移数据, 提交工单免费切换地域, 重启时选择新的地域]
    answer: 1
    why: 资源建好后不能换地域，只能在新地域重建（可以借助镜像、快照迁移）。
sources:
  - { title: "阿里云：ECS 的地域和可用区", url: https://help.aliyun.com/zh/ecs/user-guide/regions-and-zones }
  - { title: "AWS: Regions and Availability Zones", url: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html }
---
## 为什么重要
地域决定访问延迟、价格和合规（在中国内地用云服务器对外提供网站要备案），而且资源建好后不能换。同一地域的资源才能直接走内网互通。

## 在控制台里
选离用户最近的地域，和要互访的数据库、存储放在一起。要容灾就把实例分到同一地域的不同可用区。
