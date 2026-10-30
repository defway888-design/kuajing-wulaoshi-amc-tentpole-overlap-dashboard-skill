# 跨境吴老师 AMC Tentpole 阶段重叠看板 Skill

使用一份 Amazon Marketing Cloud 的 Tentpole Phase Overlap ASIN conversions CSV，生成固定版式、可离线打开的单文件 BI 看板。

## 适用场景

适用于核对大促预热、活动、返场三个阶段的七种广告曝光组合，并查看覆盖天数、触达、详情页浏览、购买人数、广告花费及 ROAS。不处理其他 AMC 报表，也不合并两份 CSV 做对比。

## 运行前准备

- 一份本次运行的 AMC Tentpole Phase Overlap ASIN conversions CSV。Skill 会核对 20 个必需字段与七行组合；无需准备示例数据。
- 运行环境可使用 Node.js 18 或更高版本。不需要额外的 npm 包、MCP 服务或联网图表库。
- 准备确认 CSV 中 `tentpole_path` 的三个阶段输入值各自对应预热、活动还是返场。每份新文件都需要重新确认。

## 首次安装

这是公开仓库。无需向跨境吴老师提交 GitHub 用户名、接受私有仓库邀请或提供密码与令牌。将下面整段指令发送给 Codex：

```text
请从 https://github.com/defway888-design/kuajing-wulaoshi-amc-tentpole-overlap-dashboard-skill 安装跨境吴老师 AMC Tentpole 阶段重叠看板 Skill，并在安装后告诉我如何启动。
```

如果当前 Codex 会话尚未识别新安装的 Skill，请按客户端提示刷新或重新打开会话。

## 启动方式

上传本次 AMC CSV，然后发送：

```text
使用 $kuajing-wulaoshi-amc-tentpole-overlap-dashboard，根据我上传的 Tentpole Phase Overlap CSV 生成看板。
```

## 执行结果与失败边界

Skill 先检查 CSV 的字段、七种组合和数值格式，再依次请你选择 `tentpole_path` 输入值的阶段含义；标准三值情形下，确认前两个后由排除法确定第三个。确认通过后，使用包内固定模板生成一个可离线打开的 HTML，看板含四张总览卡片、覆盖天数、触达与浏览柱形加购买人数右轴折线的组合图、广告花费柱形与 ROAS 折线双轴图，以及可下载的七组明细。部分 AMC 空聚合在对应人数明确为零时按零计算，其余空值保留为缺失，不计算不完整的总量。

字段缺失、组合不完整、阶段映射冲突或模板校验失败时停止生成，不猜测阶段含义，也不临时改版。CSV 无法证明 AMC 查询使用了哪一种 ASIN 转化口径；请以实际查询设置为准。阶段组合是描述性分组，看板不将其解释为增量效果。

请只在自己的运行环境中处理真实业务 CSV；不要把客户数据、密码或令牌提交到本公开仓库。

## 仓库文件

- [`SKILL.md`](SKILL.md)：执行入口与固定工作流程。
- [`agents/openai.yaml`](agents/openai.yaml)：Codex 支持时使用的显示名称与默认启动语。
- [`references/data-contract.md`](references/data-contract.md)：字段、阶段映射和计算口径。
- [`assets/dashboard_template.html`](assets/dashboard_template.html)：带吴老师品牌标识的固定离线模板。
- [`scripts/tentpole_dashboard.cjs`](scripts/tentpole_dashboard.cjs)：CSV 核验和看板生成程序。
- [`scripts/selftest.cjs`](scripts/selftest.cjs)：本地自检程序。

## 版本更新记录

### v1.0.4｜2026-10-31

- 购买人数折线改用右侧次坐标轴，触达人数（÷100）与详情页浏览次数保留左轴；图例与轴标题明确标出各指标刻度。
- 点选读数和下载明细仍提供原始人数，其他栏目保持不变。

### v1.0.3｜2026-10-31

- 将阶段组合图中的购买人数从柱形改为绿色折线与节点；触达、详情页浏览保留柱形，三项继续共用线性展示刻度。
- 点选读数和明细仍显示原始数值；缺失购买值会使折线断开。

### v1.0.2｜2026-10-31

- 三指标共用一条线性展示坐标轴：触达人数在图中缩小 100 倍，浏览次数与购买人数保持原值，柱高按展示值的真实比例绘制，不强制固定顺序。
- 图例标明“触达人数（÷100）”；点选和下载明细显示原始人数。保留四张总览卡和原有栏目、配色。

### v1.0.1｜2026-10-30

- 支持 CSV 中的空数值：仅依据对应零人数将特定空聚合确认为零；其他空值保留为缺失，并在图表、总览和明细中安全显示。
- 影响范围：数据核验、指标显示和导出；看板栏目、排版与配色保持固定。

### v1.0.0｜2026-10-30

- 首次发布单份 AMC Tentpole Phase Overlap CSV 的固定版式看板流程、数据核验程序和吴老师品牌模板。
- 影响范围：Skill 执行流程、离线 HTML 交付与公开仓库安装说明。
