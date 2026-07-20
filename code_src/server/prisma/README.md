# SQLite 数据库目录

- schema.prisma：Prisma 数据模型。
- migrations/0001_init/migration.sql：首个 SQLite 建表脚本。
- ../data/personal-planet.db：本地数据库文件，不应提交到 Git。

使用 sqlite3.exe 验证表结构：

    D:Program_Professionalsqlite_appsqlitesqlite3.exe ..datapersonal-planet.db ".tables"

当前项目已生成数据库表。下一步安装 Prisma 依赖并将 NestJS 内存数组迁移为 Prisma 查询。