# 例外：手改 registry

仅当用户明确要求恢复、且不能走插件页时使用。平时走插件页装 `.piplug`。

## 步骤

1. 保持 PI-Desktop 进程存活。不要强杀。
2. 若 `source:dev` 且 dest 没了：把 `installed/` 拷回 dest，两边同步到同一版本，让热加载重新找到 `manifest.json`。
3. 备份 `~/.pi-desktop/plugins/registry.json` 到 PI scratch（UTF-8 原文）。
4. 用 Python 等 UTF-8 运行时改到 scratch 临时文件。不要用 PowerShell `ConvertTo-Json` 写这个顶层数组：会搞乱编码、把数组包成对象、改空数组形状。
5. 立刻 `json.loads`：仍是数组；长度与 id 列表不变；目标 name/version/path/source 正确；`Path(path)/manifest.json` 存在。
6. 文件复制替换正式 registry，再读一次往返校验。
7. 等热加载。随后仍应在插件页装 `.piplug`，把 `source` 钉成 `installed`。只改登记会被宿主写回脚手架版本。

`id` 保持不变。改的是显示名、版本、`path`、`source`、`scope`。
