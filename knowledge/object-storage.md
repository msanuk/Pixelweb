---
id: object-storage
title: 对象存储
aliases: [S3, 存储桶, Bucket ACL, 公共读写, 公共读, 阻止公共访问, Block Public Access, Bucket Policy]
keywords: [OSS, bucket, 签名 URL, 静态网站]
category: cloud
level: 1
summary: 按「存储桶 + 文件路径」存文件的云服务（阿里云 OSS、AWS S3），常放图片、备份和静态网站；读写权限决定谁能访问里面的文件。
related: [ram-iam, access-key]
quiz:
  - q: 网站图片要让所有人能看、只有自己的程序能上传，存储桶权限选哪个？
    options: [私有, 公共读, 公共读写, 关闭所有鉴权]
    answer: 1
    why: 公共读允许匿名读取，写入仍要授权；公共读写连上传、删除都对所有人开放。
sources:
  - { title: "阿里云：通过 Bucket ACL 控制读写权限", url: https://help.aliyun.com/zh/oss/user-guide/bucket-acl-2 }
  - { title: "AWS: Blocking public access to your S3 storage", url: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html }
---
## 为什么重要
「公共读写」意味着任何人都能上传、覆盖、删除你的文件，还可能被拿去存违规内容、刷你的流量费。默认开启的「阻止公共访问」就是防这个的。

## 在控制台里
默认选私有；要公开的文件用公共读，或者给有效期的签名 URL。几乎没有理由选公共读写。
