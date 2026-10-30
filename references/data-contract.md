# Tentpole Phase Overlap 数据契约

本 Skill 只处理 AMC Tentpole Phase Overlap 的单份 ASIN conversions 导出。`inspect` 要求 7 行和以下 20 个字段；允许额外字段，但不会把额外字段编入固定看板。

`tentpole_path`, `duration_days`, `impressions`, `unique_reach_purchase`, `unique_reach_dpv`, `unique_viewers`, `unique_purchasers`, `unique_ntb_purchasers`, `dpv`, `sales`, `ntb_sales`, `ad_spend`, `roas`, `unique_reach_percentage`, `sales_percentage`, `unique_ntb_purchasers_percentage`, `average_daily_impressions`, `dpv_rate`, `purchase_rate`, `ntb_rate`。

路径应由方括号包住，以英文或中文逗号分隔一至三个阶段。阶段名称本身不能含逗号，否则无法可靠区分名称与阶段分隔符，应请用户重新导出或提供无歧义的阶段名。编号前缀如 `[1 自定义名称, 2 自定义名称]` 的键是 `1`、`2`；无编号时以完整阶段片段为键。解析只负责提取输入键，不负责判定阶段含义。用户确认后的映射必须覆盖观察到的全部键，并使 7 行各自对应七种不同组合。不同输入键若是同一阶段的别名，可在用户逐项确认后映射到同一标准阶段；同一路径内不允许映射后的重复阶段。

所有计数字段要求非负整数；天数要求正整数；其他数值要求非负且非空。三个份额字段按原表的小数格式要求落在 0–1。`roas` 与 `sales/ad_spend` 的差异容许原表两位小数的舍入误差。七种组合的覆盖天数必须与组成阶段的天数之和一致。没有有效分母时，所涉及的比率在看板中显示 `—`，不能把空值当成零。

看板总体 ROAS = 七组 `sales` 之和 ÷ 七组 `ad_spend` 之和；每组 ROAS 也按该组原始金额重新计算。七组总销售额、广告花费、购买人数、购买口径触达人数取对应字段之和。七组是 AMC 查询形成的阶段曝光组合；这些描述性分组不等于增量效果。原表不含活动名称、站点、币种、ASIN 级明细，也无法从 CSV 本身判定 ASIN 转化口径。
