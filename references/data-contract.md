# Tentpole Phase Overlap 数据契约

本 Skill 只处理 AMC Tentpole Phase Overlap 的单份 ASIN conversions 导出。`inspect` 要求 7 行和以下 20 个字段；允许额外字段，但不会把额外字段编入固定看板。

`tentpole_path`, `duration_days`, `impressions`, `unique_reach_purchase`, `unique_reach_dpv`, `unique_viewers`, `unique_purchasers`, `unique_ntb_purchasers`, `dpv`, `sales`, `ntb_sales`, `ad_spend`, `roas`, `unique_reach_percentage`, `sales_percentage`, `unique_ntb_purchasers_percentage`, `average_daily_impressions`, `dpv_rate`, `purchase_rate`, `ntb_rate`。

路径应由方括号包住，以英文或中文逗号分隔一至三个阶段。阶段名称本身不能含逗号，否则无法可靠区分名称与阶段分隔符，应请用户重新导出或提供无歧义的阶段名。编号前缀如 `[1 自定义名称, 2 自定义名称]` 的键是 `1`、`2`；无编号时以完整阶段片段为键。解析只负责提取输入键，不负责判定阶段含义。用户确认后的映射必须覆盖观察到的全部键，并使 7 行各自对应七种不同组合。不同输入键若是同一阶段的别名，可在用户逐项确认后映射到同一标准阶段；同一路径内不允许映射后的重复阶段。

有值的计数字段要求非负整数；`duration_days` 每行必须是正整数，不可为空；其他数值可以为空，有值时必须为非负有限数。三个份额字段有值时要求落在 0–1。若 `roas`、`sales` 与正的 `ad_spend` 都有值，`roas` 与 `sales/ad_spend` 的差异容许原表两位小数的舍入误差。七种组合的覆盖天数必须与组成阶段的天数之和一致。

空聚合只在有同组零人数证据时才确定为零：`dpv` 空且 `unique_viewers=0`；`sales` 空且 `unique_purchasers=0`；`ntb_sales` 空且 `unique_ntb_purchasers=0`。其余空值保留为缺失，不将空字符串直接转成数字零。看板对应表格和读数显示 `—`，下载明细留空，缺失的柱形或折线点不绘制。任何分组值缺失时，相应的七组总量及依赖该总量的 ROAS、份额显示 `—`，不能把部分求和当总量。原始比率列即使为空，也可由完整的原始分子、分母重新计算；没有有效分母时显示 `—`。

看板总体 ROAS = 七组 `sales` 之和 ÷ 七组 `ad_spend` 之和；每组 ROAS 也按该组原始金额重新计算。七组总销售额、广告花费、购买人数、购买口径触达人数取对应字段之和。七组是 AMC 查询形成的阶段曝光组合；这些描述性分组不等于增量效果。原表不含活动名称、站点、币种、ASIN 级明细，也无法从 CSV 本身判定 ASIN 转化口径。

三指标柱形图共用一条线性展示坐标轴：仅蓝色触达人数按 `unique_reach_purchase ÷ 100` 绘制，橙色 `dpv` 与绿色 `unique_purchasers` 使用原值。轴上限取七行的三项展示值最大值后向上取整，柱高按展示值的真实比例绘制，不设最低柱高，也不强制形成 `触达 > 浏览 > 购买`。图例明确标出触达缩小 100 倍；点选组合和下载明细均显示原始未缩放数值。原值为零的柱保持零高，缺失的柱不绘制。
